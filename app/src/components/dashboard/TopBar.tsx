import { HardDrive, LayoutGrid, Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface TopBarProps {
    currentFolderName: string;
    selectedIds: number[];
    onShowMoveModal: () => void;
    onBulkDownload: () => void;
    onBulkDelete: () => void;
    onDownloadFolder: () => void;
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onToggleSidebar: () => void;
}

export function TopBar({
    currentFolderName, selectedIds, onShowMoveModal, onBulkDownload, onBulkDelete,
    onDownloadFolder, viewMode, setViewMode, searchTerm, onSearchChange, onToggleSidebar
}: TopBarProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="h-14 border-b border-telegram-border flex items-center px-2 md:px-4 justify-between bg-telegram-surface/80 backdrop-blur-md sticky top-0 z-10 w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <button onClick={onToggleSidebar} className="p-2 md:hidden text-telegram-text hover:bg-telegram-hover rounded-lg transition-colors">
                    <Menu className="w-6 h-6" />
                </button>

                <div className="hidden sm:flex items-center text-sm breadcrumbs text-telegram-subtext select-none">
                    <span className="hover:text-telegram-text cursor-pointer transition-colors">Start</span>
                    <span className="mx-2">/</span>
                    <span className="text-telegram-text font-medium truncate max-w-[120px] md:max-w-xs">{currentFolderName}</span>
                </div>
            </div>

            <div className="flex-1 max-w-md mx-2">
                <input
                    type="text"
                    placeholder="Search..."
                    className="w-full bg-telegram-hover border border-telegram-border rounded-lg px-3 py-1.5 text-sm text-telegram-text placeholder:text-telegram-subtext focus:outline-none focus:border-telegram-primary/50 transition-colors"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                {/* Contextual actions appear only when items are selected */}
                {selectedIds.length > 0 && (
                    <div className="hidden md:flex items-center gap-2 mr-4 animate-in fade-in slide-in-from-top-2">
                        <span className="text-xs text-telegram-subtext mr-2">{selectedIds.length} Selected</span>
                        <button onClick={onShowMoveModal} className="px-3 py-1.5 bg-telegram-primary/20 hover:bg-telegram-primary/30 text-telegram-primary rounded-md text-xs transition font-medium">Move</button>
                        <button onClick={onBulkDownload} className="px-3 py-1.5 bg-telegram-hover hover:bg-telegram-border rounded-md text-xs text-telegram-text transition">Download</button>
                        <button onClick={onBulkDelete} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-xs transition">Delete</button>
                    </div>
                )}

                <button onClick={onDownloadFolder} className="hidden sm:block p-2 hover:bg-telegram-hover rounded-md text-telegram-subtext hover:text-telegram-text transition group relative">
                    <HardDrive className="w-5 h-5" />
                </button>

                <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="hidden sm:block p-2 hover:bg-telegram-hover rounded-md text-telegram-subtext hover:text-telegram-text transition relative group">
                    <LayoutGrid className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-telegram-border mx-1 hidden sm:block"></div>

                <button onClick={toggleTheme} className="p-2 hover:bg-telegram-hover rounded-md text-telegram-subtext hover:text-telegram-text transition relative group">
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
        </header>
    )
}