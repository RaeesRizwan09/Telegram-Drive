import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileCard } from './FileCard';
import { EmptyState } from './EmptyState';
import { TelegramFile } from '../../types';
import { ContextMenu } from './ContextMenu';
import { FileListItem } from './FileListItem';
import { isMediaFile, isPdfFile, isImageFile } from '../../utils';

type SortField = 'name' | 'size' | 'date';
type SortDirection = 'asc' | 'desc';
type FilterMode = 'all' | 'media' | 'images' | 'documents';

interface FileExplorerProps {
    files: TelegramFile[];
    loading: boolean;
    error: Error | null;
    viewMode: 'grid' | 'list';
    selectedIds: number[];
    activeFolderId: number | null;
    onFileClick: (e: React.MouseEvent, id: number) => void;
    onDelete: (id: number) => void;
    onDownload: (id: number, name: string) => void;
    onPreview: (file: TelegramFile, orderedFiles?: TelegramFile[]) => void;
    onManualUpload: () => void;
    onSelectionClear: () => void;
    onToggleSelection: (id: number) => void;
    onDrop?: (e: React.DragEvent, folderId: number) => void;
    onDragStart?: (fileId: number) => void;
    onDragEnd?: () => void;
}

// Dynamically calculates grid columns based on container width for responsive scaling
function useGridColumns(containerRef: React.RefObject<HTMLDivElement | null>) {
    const [columns, setColumns] = useState(4);
    const [containerWidth, setContainerWidth] = useState(800);

    useEffect(() => {
        if (!containerRef.current) return;
        const updateColumns = () => {
            const width = containerRef.current?.clientWidth || 800;
            setContainerWidth(width);
            if (width < 450) setColumns(2); 
            else if (width < 640) setColumns(3);
            else if (width < 1024) setColumns(4);
            else setColumns(6);
        };
        updateColumns();
        const observer = new ResizeObserver(updateColumns);
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [containerRef]);

    return { columns, containerWidth };
}

export function FileExplorer({
    files, loading, error, viewMode, selectedIds, activeFolderId,
    onFileClick, onDelete, onDownload, onPreview, onManualUpload, onSelectionClear, onToggleSelection, onDrop, onDragStart, onDragEnd
}: FileExplorerProps) {
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: TelegramFile } | null>(null);

    const parentRef = useRef<HTMLDivElement>(null);
    const { columns, containerWidth } = useGridColumns(parentRef);

    const GAP = 8;
    const cardWidth = (containerWidth - (GAP * (columns - 1))) / columns;
    const cardHeight = cardWidth * 0.85; 
    const rowHeight = Math.max(cardHeight + GAP, 120);

    const handleContextMenu = useCallback((e: React.MouseEvent, file: TelegramFile) => {
        e.preventDefault();
        e.stopPropagation();
        const x = Math.min(e.clientX, window.innerWidth - 200); 
        setContextMenu({ x, y: e.clientY, file });
    }, []);

    const filteredAndSortedFiles = useMemo(() => {
        let result = [...files];
        
        if (filterMode === 'media') {
            result = result.filter(f => isMediaFile(f.name) || f.type === 'folder');
        } else if (filterMode === 'images') {
            result = result.filter(f => isImageFile(f.name) || f.type === 'folder');
        } else if (filterMode === 'documents') {
            result = result.filter(f => isPdfFile(f.name) || f.name.match(/\.(doc|docx|txt|xls|xlsx|csv)$/i) || f.type === 'folder');
        }

        return result.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'name') comparison = a.name.localeCompare(b.name);
            else if (sortField === 'size') comparison = (a.size || 0) - (b.size || 0);
            else if (sortField === 'date') comparison = (a.created_at || '').localeCompare(b.created_at || '');
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [files, sortField, sortDirection, filterMode]);

    const handlePreviewRequest = useCallback((file: TelegramFile) => {
        onPreview(file, filteredAndSortedFiles);
    }, [onPreview, filteredAndSortedFiles]);

    const gridRows = useMemo(() => {
        const rows: (TelegramFile | 'upload')[][] = [];
        const itemsWithUpload: (TelegramFile | 'upload')[] = [...filteredAndSortedFiles, 'upload'];
        for (let i = 0; i < itemsWithUpload.length; i += columns) {
            rows.push(itemsWithUpload.slice(i, i + columns));
        }
        return rows;
    }, [filteredAndSortedFiles, columns]);

    const listItems = useMemo(() => {
        return activeFolderId === null ? [...filteredAndSortedFiles, 'upload' as const] : filteredAndSortedFiles;
    }, [filteredAndSortedFiles, activeFolderId]);

    // Implements DOM virtualization to maintain performance when rendering thousands of files
    const gridVirtualizer = useVirtualizer({
        count: gridRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: useCallback(() => rowHeight, [rowHeight]),
        overscan: 2,
        gap: GAP,
    });

    useEffect(() => {
        gridVirtualizer.measure();
    }, [rowHeight, gridVirtualizer]);

    const listVirtualizer = useVirtualizer({
        count: listItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 48,
        overscan: 5,
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDirection('asc'); }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30 hidden sm:block" />;
        return sortDirection === 'asc'
            ? <ArrowUp className="w-3 h-3 text-telegram-primary" />
            : <ArrowDown className="w-3 h-3 text-telegram-primary" />;
    };

    if (loading) {
        return (
            <div className="flex-1 p-6 flex justify-center items-center text-telegram-subtext flex-col gap-4">
                <div className="w-8 h-8 border-4 border-telegram-primary border-t-transparent rounded-full animate-spin"></div>
                Loading your files...
            </div>
        )
    }

    if (error) {
        return <div className="flex-1 p-6 flex justify-center items-center text-red-400">Error loading files</div>
    }

    if (files.length === 0) {
        return (
            <div className="flex-1 p-6 overflow-auto">
                <EmptyState onUpload={onManualUpload} />
            </div>
        );
    }

    return (
        <div ref={parentRef} className="flex-1 p-2 md:p-6 overflow-auto custom-scrollbar" onClick={(e) => { if (e.target === e.currentTarget) onSelectionClear(); }}>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sticky top-0 bg-telegram-bg/95 backdrop-blur-md z-10 py-2 px-1">
                <div className="flex gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
                    {(['all', 'media', 'images', 'documents'] as FilterMode[]).map((mode) => (
                        <button 
                            key={mode}
                            onClick={() => setFilterMode(mode)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterMode === mode ? 'bg-telegram-primary text-white shadow-md' : 'bg-white/5 text-telegram-subtext hover:bg-white/10'}`}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1 text-xs text-telegram-subtext">
                    <span className="hidden sm:inline">Sort:</span>
                    <button onClick={() => handleSort('name')} className={`px-2 py-1.5 rounded flex items-center gap-1 ${sortField === 'name' ? 'text-telegram-primary bg-telegram-primary/10' : 'hover:bg-white/5'}`}>
                        Name <SortIcon field="name" />
                    </button>
                    <button onClick={() => handleSort('size')} className={`px-2 py-1.5 rounded flex items-center gap-1 ${sortField === 'size' ? 'text-telegram-primary bg-telegram-primary/10' : 'hover:bg-white/5'}`}>
                        Size <SortIcon field="size" />
                    </button>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="relative w-full" style={{ height: `${gridVirtualizer.getTotalSize()}px` }}>
                    {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = gridRows[virtualRow.index];
                        return (
                            <div
                                key={virtualRow.key}
                                className="absolute top-0 left-0 w-full grid"
                                style={{
                                    height: `${cardHeight}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                    gap: `${GAP}px`,
                                }}
                            >
                                {row.map((item) => {
                                    if (item === 'upload') {
                                        return (
                                            <button
                                                key="upload"
                                                onClick={(e) => { e.stopPropagation(); onManualUpload(); }}
                                                className="border-2 border-dashed border-telegram-border rounded-xl flex flex-col items-center justify-center text-telegram-subtext hover:border-telegram-primary hover:text-telegram-primary transition-all group"
                                                style={{ height: `${cardHeight}px` }}
                                            >
                                                <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                                                <span className="text-sm font-medium">Upload File</span>
                                            </button>
                                        );
                                    }
                                    const file = item;
                                    return (
                                        <FileCard
                                            key={file.id}
                                            file={file}
                                            isSelected={selectedIds.includes(file.id)}
                                            onClick={(e) => onFileClick(e, file.id)}
                                            onContextMenu={(e) => handleContextMenu(e, file)}
                                            onDelete={() => onDelete(file.id)}
                                            onDownload={() => onDownload(file.id, file.name)}
                                            onPreview={() => handlePreviewRequest(file)}
                                            onDrop={onDrop}
                                            onDragStart={onDragStart}
                                            onDragEnd={onDragEnd}
                                            activeFolderId={activeFolderId}
                                            height={cardHeight}
                                            onToggleSelection={() => onToggleSelection(file.id)}
                                        />
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col w-full">
                    <div className="relative w-full" style={{ height: `${listVirtualizer.getTotalSize()}px` }}>
                        {listVirtualizer.getVirtualItems().map((virtualItem) => {
                            const item = listItems[virtualItem.index];
                            if (item === 'upload') {
                                return (
                                    <div key="upload" className="absolute top-0 left-0 w-full" style={{ transform: `translateY(${virtualItem.start}px)` }}>
                                        <button onClick={(e) => { e.stopPropagation(); onManualUpload(); }} className="flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer border border-dashed border-telegram-border text-telegram-subtext hover:text-telegram-text hover:bg-telegram-hover w-full">
                                            <div className="w-5 h-5 flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                                            <span className="text-sm font-medium">Upload File...</span>
                                        </button>
                                    </div>
                                );
                            }
                            const file = item;
                            return (
                                <div key={file.id} className="absolute top-0 left-0 w-full" style={{ transform: `translateY(${virtualItem.start}px)` }}>
                                    <FileListItem
                                        file={file}
                                        selectedIds={selectedIds}
                                        onFileClick={onFileClick}
                                        handleContextMenu={handleContextMenu}
                                        onDragStart={onDragStart}
                                        onDragEnd={onDragEnd}
                                        onDrop={onDrop}
                                        onPreview={handlePreviewRequest}
                                        onDownload={onDownload}
                                        onDelete={onDelete}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    file={contextMenu.file}
                    onClose={() => setContextMenu(null)}
                    onDownload={() => { onDownload(contextMenu.file.id, contextMenu.file.name); setContextMenu(null); }}
                    onDelete={() => { onDelete(contextMenu.file.id); setContextMenu(null); }}
                    onPreview={() => {
                        if (contextMenu.file.type === 'folder') onFileClick({ preventDefault: () => { }, stopPropagation: () => { } } as React.MouseEvent, contextMenu.file.id);
                        else handlePreviewRequest(contextMenu.file);
                        setContextMenu(null);
                    }}
                />
            )}
        </div>
    )
}