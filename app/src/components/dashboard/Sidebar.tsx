import { useState } from 'react';
import { HardDrive, Folder, Plus, RefreshCw, LogOut, X } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { BandwidthWidget } from './BandwidthWidget';
import { TelegramFolder, BandwidthStats } from '../../types';

interface SidebarProps {
    folders: TelegramFolder[];
    activeFolderId: number | null;
    setActiveFolderId: (id: number | null) => void;
    onDrop: (e: React.DragEvent, folderId: number | null) => void;
    onDelete: (id: number, name: string) => void;
    onCreate: (name: string) => Promise<void>;
    isSyncing: boolean;
    isConnected: boolean;
    onSync: () => void;
    onLogout: () => void;
    bandwidth: BandwidthStats | null;
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({
    folders, activeFolderId, setActiveFolderId, onDrop, onDelete, onCreate,
    isSyncing, isConnected, onSync, onLogout, bandwidth, isOpen, onClose
}: SidebarProps) {
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    const submitCreate = async () => {
        if (!newFolderName.trim()) return;
        try {
            await onCreate(newFolderName);
            setNewFolderName("");
            setShowNewFolderInput(false);
        } catch {
            // Error handling managed by the parent hook
        }
    }

    return (
        <>
            {/* Mobile backdrop overlay for the slide-out drawer */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" 
                    onClick={onClose} 
                />
            )}

            <aside 
                className={`fixed md:relative z-50 w-[80%] max-w-[300px] md:w-64 h-full bg-telegram-surface border-r border-telegram-border flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 flex items-center justify-between border-b border-telegram-border md:border-none">
                    <div className="flex items-center gap-2">
                        <img src="/logo.svg" className="w-8 h-8 drop-shadow-lg" alt="Logo" />
                        <span className="font-bold text-lg text-telegram-text tracking-tight">Telegram Drive</span>
                    </div>
                    <button onClick={onClose} className="p-2 md:hidden text-telegram-subtext hover:text-white rounded-lg bg-white/5">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto min-h-0">
                    <SidebarItem
                        icon={HardDrive}
                        label="Saved Messages"
                        active={activeFolderId === null}
                        onClick={() => { setActiveFolderId(null); onClose(); }}
                        onDrop={(e: React.DragEvent) => onDrop(e, null)}
                        folderId={null}
                    />
                    {folders.map(folder => (
                        <SidebarItem
                            key={folder.id}
                            icon={Folder}
                            label={folder.name}
                            active={activeFolderId === folder.id}
                            onClick={() => { setActiveFolderId(folder.id); onClose(); }}
                            onDrop={(e: React.DragEvent) => onDrop(e, folder.id)}
                            onDelete={() => onDelete(folder.id, folder.name)}
                            folderId={folder.id}
                        />
                    ))}
                </nav>

                <div className="px-2 pb-2 border-b border-telegram-border mt-auto">
                    {showNewFolderInput ? (
                        <div className="px-3 py-2">
                            <input
                                autoFocus
                                type="text"
                                className="w-full bg-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-telegram-primary"
                                placeholder="Folder Name"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && submitCreate()}
                                onBlur={() => !newFolderName && setShowNewFolderInput(false)}
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowNewFolderInput(true)}
                            className="w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-sm font-medium text-telegram-subtext hover:bg-telegram-hover hover:text-telegram-text transition-colors border border-dashed border-telegram-border"
                        >
                            <Plus className="w-4 h-4" />
                            Create Folder
                        </button>
                    )}
                </div>

                <div className="p-4 border-t border-telegram-border">
                    <div className="flex items-center gap-2 text-telegram-subtext text-xs">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={onSync}
                            disabled={isSyncing}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 md:py-2 text-xs font-medium text-blue-500 hover:text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                            Sync
                        </button>
                        <button
                            onClick={onLogout}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 md:py-2 text-xs font-medium text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                            <LogOut className="w-3 h-3" />
                            Logout
                        </button>
                    </div>

                    {bandwidth && <BandwidthWidget bandwidth={bandwidth} />}
                </div>
            </aside>
        </>
    )
}