import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Radio,
  Wifi,
  WifiOff,
  Sparkles,
  ArrowRight,
  LogOut,
  X,
  Share2,
} from 'lucide-react';
import { useCollaboration } from '../collaborationContext';
import { PRESET_AVATAR_COLORS, generateFriendlyRoomName } from '@eventflow/core';

export const CollaborationModal: React.FC = () => {
  const {
    isModalOpen,
    setIsModalOpen,
    status,
    joinRoom,
    leaveRoom,
    updateUser,
    getShareUrl,
    copyShareLink,
  } = useCollaboration();

  const [inputRoom, setInputRoom] = useState('');
  const [userName, setUserName] = useState(status.self.name || 'Kollege');
  const [userColor, setUserColor] = useState(status.self.color || '#2563EB');
  const [copied, setCopied] = useState(false);

  if (!isModalOpen) return null;

  const handleCopy = async () => {
    const success = await copyShareLink();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const room = inputRoom.trim() || generateFriendlyRoomName();
    updateUser({ name: userName.trim() || 'Kollege', color: userColor });
    joinRoom(room, { name: userName.trim() || 'Kollege', color: userColor });
  };

  const handleRandomRoom = () => {
    setInputRoom(generateFriendlyRoomName());
  };

  const isConnected = !!status.roomName;
  const shareUrl = getShareUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Echtzeit-Kollaboration
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Gemeinsam in Echtzeit an Flows und Modellen arbeiten
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* User Profile Config */}
          <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Dein Profil auf dem Board
            </label>
            <div className="flex items-center gap-3">
              {/* Avatar Preview */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0"
                style={{ backgroundColor: userColor }}
              >
                {userName.slice(0, 2).toUpperCase() || 'ICH'}
              </div>
              <input
                type="text"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  updateUser({ name: e.target.value });
                }}
                placeholder="Dein Name"
                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-850 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
              />
            </div>

            {/* Color circles */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Farbe:</span>
              {PRESET_AVATAR_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    setUserColor(col);
                    updateUser({ color: col });
                  }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    userColor === col ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: col }}
                  title={col}
                />
              ))}
            </div>
          </div>

          {/* Connected State vs Join State */}
          {isConnected ? (
            <div className="space-y-4">
              {/* Room Status Banner */}
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                      Verbunden mit Raum:
                    </div>
                    <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200 font-mono">
                      {status.roomName}
                    </div>
                  </div>
                </div>

                <button
                  onClick={leaveRoom}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100/50 dark:hover:bg-rose-950/50 rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Verlassen
                </button>
              </div>

              {/* Share Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Einladungslink für Kollegen:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-850 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 font-mono select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        Kopiert!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Kopieren
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Connected Participants List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Aktive Teilnehmer ({status.peers.length + 1})</span>
                  <span className="text-gray-400 font-normal">Live über WebRTC</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {/* Self */}
                  <div className="px-3 py-2 flex items-center justify-between bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: status.self.color }}
                      >
                        {status.self.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {status.self.name} <span className="text-blue-500 font-normal">(Du)</span>
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                      Online
                    </span>
                  </div>

                  {/* Remote Peers */}
                  {status.peers.map((peer) => (
                    <div
                      key={peer.clientId}
                      className="px-3 py-2 flex items-center justify-between bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: peer.user.color || '#2563EB' }}
                        >
                          {peer.user.name?.slice(0, 1).toUpperCase() || 'K'}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {peer.user.name || 'Kollege'}
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                        Verbunden
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Raum-Name oder Code eingeben:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputRoom}
                    onChange={(e) => setInputRoom(e.target.value)}
                    placeholder="z.B. eventflow-team-sprint"
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-850 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleRandomRoom}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                    title="Zufälligen Raumcode generieren"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Zufällig
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Tipp: Wenn du das Feld leer lässt, wird automatisch ein neuer Raum erstellt.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>Raum beitreten / starten</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Privacy & Peer-to-Peer Info */}
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
            <Radio className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              <strong>P2P & Privatsphäre:</strong> Die Synchronisation erfolgt direkt zwischen den Browsern via WebRTC. Keine Diagrammdaten werden auf externen Cloud-Servern gespeichert.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
