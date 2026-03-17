import { RoomLobby } from "@/components/rooms/RoomLobby";

export const metadata = { title: "Rooms & Lobbies – Battle Arena" };

export default function RoomsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Rooms & Lobbies</h1>
        <p className="text-gray-600 mt-2">
          Join active rooms or browse featured lobbies
        </p>
      </div>
      
      <RoomLobby />
    </div>
  );
}
