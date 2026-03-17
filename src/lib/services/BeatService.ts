import { createClient } from "@supabase/supabase-js";

export type Beat = {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  genre: string;
  preview_url: string | null;
  file_url: string | null;
  usage_count: number | null;
  rating: number | null;
};

export class BeatService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );

  async listActive(limit = 50): Promise<Beat[]> {
    const { data, error } = await this.supabase
      .from("beats")
      .select("id,title,artist,tempo,genre,preview_url,file_url,usage_count,rating")
      .eq("is_active", true)
      .eq("status", "active")
      .limit(limit);

    if (error) {
      throw new Error(`beats_list_failed:${error.message}`);
    }

    return (data ?? []) as Beat[];
  }
}

const beatService = new BeatService();
export default beatService;
