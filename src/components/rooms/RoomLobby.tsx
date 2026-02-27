"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Room {
  id: string;
  name: string;
  description: string;
  room_type: string;
  max_participants: number;
  current_participants: number;
  room_code: string;
  is_private: boolean;
  tags: string[];
  creator: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  _count: {
    room_participants: number;
  };
}

interface Lobby {
  id: string;
  name: string;
  description: string;
  lobby_type: string;
  max_rooms: number;
  current_rooms: number;
  max_users_per_room: number;
  is_featured: boolean;
  rooms: any[];
}

export function RoomLobby() {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedLobby, setSelectedLobby] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLobbies();
    fetchRooms();
  }, []);

  const fetchLobbies = async () => {
    try {
      const response = await fetch("/api/lobbies?featured=true");
      const data = await response.json();
      if (data.ok) {
        setLobbies(data.lobbies);
      }
    } catch (error) {
      console.error("Failed to fetch lobbies:", error);
    }
  };

  const fetchRooms = async (lobbyType?: string) => {
    try {
      const params = new URLSearchParams();
      if (lobbyType) params.append("type", lobbyType);
      if (searchTerm) params.append("search", searchTerm);
      
      const response = await fetch(`/api/rooms?${params.toString()}`);
      const data = await response.json();
      if (data.ok) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLobbySelect = (lobbyId: string, lobbyType: string) => {
    setSelectedLobby(lobbyId === selectedLobby ? null : lobbyId);
    fetchRooms(lobbyType === selectedLobby ? undefined : lobbyType);
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      window.location.href = `/app/rooms/${roomId}`;
    } catch (error) {
      console.error("Failed to join room:", error);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-4">
        <Input
          placeholder="Search rooms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <Button onClick={() => fetchRooms(selectedLobby || undefined)}>
          Search
        </Button>
      </div>

      {/* Featured Lobbies */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Featured Lobbies</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {lobbies.map((lobby) => (
            <Card
              key={lobby.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedLobby === lobby.id ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => handleLobbySelect(lobby.id, lobby.lobby_type)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{lobby.name}</h3>
                  {lobby.is_featured && <Badge variant="secondary">Featured</Badge>}
                </div>
                <p className="text-sm text-gray-600">{lobby.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{lobby.current_rooms || 0} rooms</span>
                  <span>{lobby.max_users_per_room} max/users</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Active Rooms */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {selectedLobby ? "Rooms in Lobby" : "All Active Rooms"}
          </h2>
          <Badge variant="outline">{filteredRooms.length} rooms</Badge>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading rooms...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No active rooms found</p>
            <p className="text-sm text-gray-400 mt-2">
              {searchTerm ? "Try a different search term" : "Create a new room to get started!"}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRooms.map((room) => (
              <Card key={room.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{room.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{room.description}</p>
                    </div>
                    {room.is_private && <Badge variant="outline">Private</Badge>}
                  </div>

                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={room.creator.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {room.creator.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-500">
                      Host: {room.creator.username}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {room.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {room.room_type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {room._count.room_participants}/{room.max_participants}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {room.room_code}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleJoinRoom(room.id)}
                        disabled={room._count.room_participants >= room.max_participants}
                      >
                        {room._count.room_participants >= room.max_participants ? "Full" : "Join"}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
