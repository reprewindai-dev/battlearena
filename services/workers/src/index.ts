import express, { Request, Response } from 'express';
import cron from 'node-cron';
import { config } from './config';
import { logger } from './lib/logger';
import { redis } from './lib/redis';

import { scheduleDailyPayouts, payoutWorker } from './jobs/payout-processor';
import { processQueuedContent, moderationWorker } from './jobs/moderation-processor';
import { generateDailyReport } from './jobs/daily-report';
import { runFraudDetection } from './jobs/fraud-detection';
import { runAllCleanupTasks } from './jobs/cleanup';
import { recalculateRatings } from './jobs/rating-recalculation';
import { calculateMonthlyCRF, distributeTournamentPrizes, processGrantApplications } from './jobs/crf-allocation';
import { progressTournaments } from './jobs/tournament-processor';
import { runHealthCheck } from './jobs/health-metrics';
import { runEngagementAnalysis } from './jobs/user-engagement';

const app = express();
app.use(express.json());

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await redis.ping();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: String(error) });
  }
});

app.get('/metrics', async (_req: Request, res: Response) => {
  const metrics = await runHealthCheck();
  res.json(metrics);
});

app.post('/jobs/trigger/:jobName', async (req: Request, res: Response) => {
  const { jobName } = req.params;
  const jobs: Record<string, () => Promise<unknown>> = {
    payouts: scheduleDailyPayouts,
    moderation: processQueuedContent,
    report: generateDailyReport,
    fraud: runFraudDetection,
    cleanup: runAllCleanupTasks,
    ratings: recalculateRatings,
    crf: calculateMonthlyCRF,
    prizes: distributeTournamentPrizes,
    grants: processGrantApplications,
    tournaments: progressTournaments,
    health: runHealthCheck,
    engagement: runEngagementAnalysis,
  };

  if (!jobs[jobName]) {
    return res.status(404).json({ error: 'Job not found' });
  }

  try {
    logger.info({ jobName }, 'Manually triggering job');
    const result = await jobs[jobName]();
    res.json({ success: true, jobName, result });
  } catch (error) {
    logger.error({ jobName, error }, 'Job execution failed');
    res.status(500).json({ error: String(error) });
  }
});

const initCronJobs = () => {
  logger.info('Initializing cron jobs');

  cron.schedule(config.jobs.healthMetrics, async () => {
    try {
      await runHealthCheck();
    } catch (error) {
      logger.error({ error }, 'Health metrics job failed');
    }
  });

  cron.schedule(config.jobs.moderationQueue, async () => {
    try {
      await processQueuedContent();
    } catch (error) {
      logger.error({ error }, 'Moderation queue job failed');
    }
  });

  cron.schedule(config.jobs.fraudDetection, async () => {
    try {
      await runFraudDetection();
    } catch (error) {
      logger.error({ error }, 'Fraud detection job failed');
    }
  });

  cron.schedule(config.jobs.tournamentProgression, async () => {
    try {
      await progressTournaments();
    } catch (error) {
      logger.error({ error }, 'Tournament progression job failed');
    }
  });

  cron.schedule(config.jobs.payoutProcessing, async () => {
    try {
      await scheduleDailyPayouts();
    } catch (error) {
      logger.error({ error }, 'Payout processing job failed');
    }
  });

  cron.schedule(config.jobs.dailyReport, async () => {
    try {
      await generateDailyReport();
    } catch (error) {
      logger.error({ error }, 'Daily report job failed');
    }
  });

  cron.schedule(config.jobs.staleRecordingCleanup, async () => {
    try {
      await runAllCleanupTasks();
    } catch (error) {
      logger.error({ error }, 'Cleanup job failed');
    }
  });

  cron.schedule(config.jobs.ratingRecalculation, async () => {
    try {
      await recalculateRatings();
    } catch (error) {
      logger.error({ error }, 'Rating recalculation job failed');
    }
  });

  cron.schedule(config.jobs.userEngagement, async () => {
    try {
      await runEngagementAnalysis();
    } catch (error) {
      logger.error({ error }, 'User engagement job failed');
    }
  });

  cron.schedule(config.jobs.crfAllocation, async () => {
    try {
      await calculateMonthlyCRF();
      await distributeTournamentPrizes();
      await processGrantApplications();
    } catch (error) {
      logger.error({ error }, 'CRF allocation job failed');
    }
  });

  logger.info('All cron jobs initialized');
};

const startWorkers = () => {
  logger.info('Starting queue workers');
  payoutWorker.on('ready', () => logger.info('Payout worker ready'));
  moderationWorker.on('ready', () => logger.info('Moderation worker ready'));
};

const shutdown = async () => {
  logger.info('Shutting down workers service');
  await payoutWorker.close();
  await moderationWorker.close();
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Workers service started');
  initCronJobs();
  startWorkers();
});
