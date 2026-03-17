export interface BotPersonality {
  id: string;
  name: string;
  avatar: string;
  style: string;
  difficulty: 'easy' | 'medium' | 'hard';
  introLines: string[];
  victoryLines: string[];
  defeatLines: string[];
  tauntLines: string[];
  rhymePatterns: string[];
  vocabularyThemes: string[];
}

export const BOT_PERSONALITIES: BotPersonality[] = [
  {
    id: 'rookie_rhymez',
    name: 'Rookie Rhymez',
    avatar: '🎤',
    style: 'Basic rhymes, simple patterns',
    difficulty: 'easy',
    introLines: [
      "Let me show you how it's done!",
      "Time for a masterclass!",
      "Watch and learn, rookie!"
    ],
    victoryLines: [
      "Too easy! Try again next year!",
      "That's how we do it!",
      "Game over! Better luck next time!"
    ],
    defeatLines: [
      "You got lucky this time!",
      "I'll be back stronger!",
      "Good battle, respect!"
    ],
    tauntLines: [
      "Is that all you got?",
      "My grandma raps better!",
      "You're not ready for this!"
    ],
    rhymePatterns: ['AABB', 'ABAB'],
    vocabularyThemes: ['basic', 'confidence', 'challenge']
  },
  {
    id: 'flow_master',
    name: 'Flow Master',
    avatar: '👑',
    style: 'Complex flows, multi-syllable rhymes',
    difficulty: 'medium',
    introLines: [
      "Prepare for lyrical destruction!",
      "I eat MCs like you for breakfast!",
      "Let's see what you're made of!"
    ],
    victoryLines: [
      "Another victim of the flow!",
      "Stay in your lane, amateur!",
      "This is my kingdom!"
    ],
    defeatLines: [
      "You earned this one, I'll admit!",
      "Impressive. You've got potential!",
      "Today you were better!"
    ],
    tauntLines: [
      "Your flow is weaker than water!",
      "I'm ending careers tonight!",
      "You're out of your league!"
    ],
    rhymePatterns: ['AABBCC', 'ABABCBC', 'AABBCCDD'],
    vocabularyThemes: ['advanced', 'metaphors', 'wordplay']
  },
  {
    id: 'lyrical_assassin',
    name: 'Lyrical Assassin',
    avatar: '🗡️',
    style: 'Technical precision, complex metaphors',
    difficulty: 'hard',
    introLines: [
      "Welcome to your lyrical execution!",
      "I'm about to end your whole career!",
      "Say your prayers, MC!"
    ],
    victoryLines: [
      "Rest in peace, wack MC!",
      "Another one bites the dust!",
      "This was a massacre!"
    ],
    defeatLines: [
      "You caught me off guard... well played!",
      "The student becomes the master!",
      "I'll remember this defeat!"
    ],
    tauntLines: [
      "Your bars are softer than tissue!",
      "I'm a lyrical surgeon, you're the patient!",
      "This is verbal homicide!"
    ],
    rhymePatterns: ['AABBCCDD', 'ABABCBCDC', 'complex'],
    vocabularyThemes: ['technical', 'violent', 'intellectual']
  }
];

export class BotOpponent {
  private personality: BotPersonality;
  private battleContext: {
    beat: any;
    userLines: string[];
    round: number;
  };

  constructor(personalityId: string, beat: any) {
    this.personality = BOT_PERSONALITIES.find(p => p.id === personalityId) || BOT_PERSONALITIES[0];
    this.battleContext = {
      beat,
      userLines: [],
      round: 1
    };
  }

  generateIntro(): string {
    const lines = this.personality.introLines;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  generateResponse(userLine: string): string {
    this.battleContext.userLines.push(userLine);
    
    // Generate bot response based on personality and context
    const response = this.createRhymeResponse(userLine);
    
    return response;
  }

  private createRhymeResponse(userLine: string): string {
    const themes = this.personality.vocabularyThemes;
    const patterns = this.personality.rhymePatterns;
    
    // Simple rhyme generation based on difficulty
    switch (this.personality.difficulty) {
      case 'easy':
        return this.generateEasyRhyme(userLine);
      case 'medium':
        return this.generateMediumRhyme(userLine);
      case 'hard':
        return this.generateHardRhyme(userLine);
      default:
        return this.generateEasyRhyme(userLine);
    }
  }

  private generateEasyRhyme(userLine: string): string {
    const easyRhymes = [
      "You think you're hot but you're really not!",
      "My rhymes are fire, yours are just weak!",
      "Step to the mic and get burned!",
      "I'm the king, you're the jester!"
    ];
    
    return easyRhymes[Math.floor(Math.random() * easyRhymes.length)];
  }

  private generateMediumRhyme(userLine: string): string {
    const mediumRhymes = [
      "Your flow's broken while mine's fluid like gold, / Every line I drop is worth more than you're told!",
      "I paint pictures with words, you just doodle and trace, / In this battle of wits, you're not even in the race!",
      "Metaphors sharp as razors, similes cut deep, / While you're still rhyming 'cat' with 'sleep'!",
      "My vocabulary's vast, yours is stuck on repeat, / This battle's over before you could even compete!"
    ];
    
    return mediumRhymes[Math.floor(Math.random() * mediumRhymes.length)];
  }

  private generateHardRhyme(userLine: string): string {
    const hardRhymes = [
      "I'm a lyrical architect constructing verbal monuments, / You're building sandcastles while I'm building monuments!",
      "Your cadence is elementary, my enunciation's surgical, / Each syllable I speak is purposefully purgatorial!",
      "I manipulate phonetics like a linguistic puppeteer, / Your rhymes are predictable, mine inspire fear!",
      "My wordplay's quantum physics, yours is basic arithmetic, / In this lyrical dimension, you're just plain pathetic!"
    ];
    
    return hardRhymes[Math.floor(Math.random() * hardRhymes.length)];
  }

  generateVictoryMessage(): string {
    const lines = this.personality.victoryLines;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  generateDefeatMessage(): string {
    const lines = this.personality.defeatLines;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  generateTaunt(): string {
    const lines = this.personality.tauntLines;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  getPersonality(): BotPersonality {
    return this.personality;
  }
}

export function selectBotOpponent(userSkillLevel?: number): BotPersonality {
  // Select bot based on user skill level (0-100)
  if (!userSkillLevel) userSkillLevel = 50;
  
  if (userSkillLevel < 33) {
    return BOT_PERSONALITIES[0]; // Easy
  } else if (userSkillLevel < 66) {
    return BOT_PERSONALITIES[1]; // Medium
  } else {
    return BOT_PERSONALITIES[2]; // Hard
  }
}
