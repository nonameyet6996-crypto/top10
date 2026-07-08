"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MAX_PHOTOS = 10;
const ROWS = 2;
const PER_ROW = MAX_PHOTOS / ROWS;
const ITEM_WIDTH = 170; // The fixed size of the invisible "slot" on the string
const GAP = 48; // Increased gap to allow wider horizontal images to breathe
const ROW_GAP = 140;
const DIP_HEIGHT = 48;
const MIN_ASPECT = 0.65;
const MAX_ASPECT = 1.6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `photo-${idCounter}-${Date.now()}`;
}

function makePhoto(url = null, aspect = 1) {
  return {
    id: nextId(),
    url,
    aspect,
    tilt: Math.random() * 8 - 4,
  };
}

function readFileAsPhotoPayload(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const raw = img.naturalWidth / (img.naturalHeight || 1);
      const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, raw || 1));
      resolve({ url, aspect });
    };
    img.onerror = () => resolve({ url, aspect: 1 });
    img.src = url;
  });
}

function hangOffset(index, count) {
  if (count <= 1) return 0;
  const t = index / (count - 1);
  return Math.sin(t * Math.PI) * DIP_HEIGHT;
}

function moveItem(arr, from, to) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function Heart({ className, style }) {
  return (
    <svg viewBox="0 0 32 29" className={className} style={style} fill="currentColor">
      <path d="M16 28.5s-1-.7-4.9-4C4.7 19.6 1 15.7 1 10.9 1 6.9 4.1 3.8 8 3.8c2.3 0 4.4 1.2 6 3.2 1.6-2 3.7-3.2 6-3.2 3.9 0 7 3.1 7 7.1 0 4.8-3.7 8.7-10.1 13.6-3.9 3.3-4.9 4-4.9 4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PhotoStringGallery() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [photos, setPhotos] = useState(() =>
    Array.from({ length: MAX_PHOTOS }, () => makePhoto(null))
  );

  const [fileDragOverIndex, setFileDragOverIndex] = useState(null);
  const [reorderState, setReorderState] = useState({ draggingId: null, hoverIndex: null });

  const fileInputTarget = useRef(null);
  const rowRefs = useRef([]);

  const containerWidth = PER_ROW * ITEM_WIDTH + (PER_ROW - 1) * GAP;
  const rows = [photos.slice(0, PER_ROW), photos.slice(PER_ROW, MAX_PHOTOS)];

  const computeTargetIndex = useCallback((clientX, clientY) => {
    let bestRow = 0;
    let bestDist = Infinity;

    rowRefs.current.forEach((el, r) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestRow = r;
      }
    });

    const rowEl = rowRefs.current[bestRow];
    if (!rowEl) return null;
    const rect = rowEl.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const col = Math.min(PER_ROW - 1, Math.max(0, Math.floor(relativeX / (ITEM_WIDTH + GAP))));
    return bestRow * PER_ROW + col;
  }, []);

  const handleDragStart = (id) => () => {
    setReorderState({ draggingId: id, hoverIndex: photos.findIndex((p) => p.id === id) });
  };

  const handleDrag = (id) => (event, info) => {
    const clientX = event.clientX ?? (event.touches && event.touches[0]?.clientX);
    const clientY = event.clientY ?? (event.touches && event.touches[0]?.clientY);
    
    const x = clientX !== undefined ? clientX : info.point.x - window.scrollX;
    const y = clientY !== undefined ? clientY : info.point.y - window.scrollY;

    const target = computeTargetIndex(x, y);
    if (target != null) {
      setReorderState((s) => {
        if (s.hoverIndex === target) return s;
        return { ...s, hoverIndex: target };
      });
    }
  };

  const handleDragEnd = (id) => () => {
    const from = photos.findIndex((p) => p.id === id);
    const to = reorderState.hoverIndex;
    if (to != null && to !== from) {
      setPhotos((prev) => moveItem(prev, from, to));
    }
    setReorderState({ draggingId: null, hoverIndex: null });
  };

  const insertPhotoAt = useCallback((index, url, aspect) => {
    setPhotos((prev) => {
      const next = [...prev];
      const clampedIndex = Math.max(0, Math.min(index, next.length));
      next.splice(clampedIndex, 0, makePhoto(url, aspect));
      next.length = MAX_PHOTOS;
      return next;
    });
  }, []);

  const replacePhotoAt = useCallback((index, url, aspect) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], url, aspect };
      return next;
    });
  }, []);

  const handleFileDragOver = (index) => (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setFileDragOverIndex((current) => (current === index ? current : index));
    }
  };

  const handleFileDragLeave = (index) => (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFileDragOverIndex((current) => (current === index ? null : current));
  };

  const handleFileDrop = (index) => async (e) => {
    e.preventDefault();
    setFileDragOverIndex(null);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const { url, aspect } = await readFileAsPhotoPayload(file);
      insertPhotoAt(index, url, aspect);
    }
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    const index = fileInputTarget.current;
    e.target.value = "";
    if (file && file.type.startsWith("image/") && index != null) {
      const { url, aspect } = await readFileAsPhotoPayload(file);
      replacePhotoAt(index, url, aspect);
    }
  };

  const svgPath = useMemo(() => {
    const w = containerWidth;
    const midY = DIP_HEIGHT + 14;
    return `M 0 14 Q ${w / 2} ${midY} ${w} 14`;
  }, [containerWidth]);

  const bgHearts = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 12 + Math.random() * 20,
        rotate: Math.random() * 40 - 20,
        opacity: 0.08 + Math.random() * 0.14,
      })),
    []
  );

  if (!isMounted) {
    return null; 
  }

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #fbfaf7 0%, #efece5 65%, #e6e2d9 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {bgHearts.map((h, i) => (
          <Heart
            key={i}
            className="absolute text-pink-300"
            style={{
              left: `${h.left}%`,
              top: `${h.top}%`,
              width: h.size,
              height: h.size,
              opacity: h.opacity,
              transform: `rotate(${h.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-4 mb-20">
        <Heart className="w-8 h-8 text-pink-400" />
        <h1 className="text-5xl font-bold tracking-wide text-pink-400 [font-family:'Quicksand','Comic_Sans_MS',sans-serif] drop-shadow-sm">
          RC TOP 10
        </h1>
        <Heart className="w-8 h-8 text-pink-400" />
      </div>

      <div
        className="relative z-10 mx-auto flex flex-col items-center"
        style={{ width: containerWidth, minWidth: containerWidth, gap: ROW_GAP }}
      >
        {rows.map((rowPhotos, rowIndex) => (
          <div key={rowIndex} className="relative" style={{ width: containerWidth }}>
            <svg
              width={containerWidth}
              height={DIP_HEIGHT + 30}
              className="absolute left-0 top-0 pointer-events-none"
              style={{ zIndex: 0 }}
            >
              <path
                d={svgPath}
                fill="none"
                stroke="#8a7a63"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <div
              ref={(el) => (rowRefs.current[rowIndex] = el)}
              className="relative flex items-start"
              style={{ gap: GAP, paddingTop: 14, zIndex: 1 }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {rowPhotos.map((photo, i) => {
                  const index = rowIndex * PER_ROW + i;
                  const isFileDragTarget = fileDragOverIndex === index;
                  const isReorderTarget =
                    reorderState.draggingId &&
                    reorderState.draggingId !== photo.id &&
                    reorderState.hoverIndex === index;
                  const isBeingDragged = reorderState.draggingId === photo.id;

                  // Equal-Area Math Strategy: 
                  // Calculate dynamic width based on aspect ratio so every photo 
                  // maintains the exact same visual weight.
                  const aspect = photo.aspect || 1;
                  const targetArea = ITEM_WIDTH * ITEM_WIDTH;
                  const optimalWidth = Math.sqrt(targetArea * aspect);
                  const clampedWidth = Math.min(220, Math.max(130, optimalWidth));

                  return (
                    <motion.div
                      key={photo.id}
                      layoutId={photo.id} 
                      layout
                      drag
                      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }} 
                      dragElastic={1}
                      dragMomentum={false}
                      onDragStart={handleDragStart(photo.id)}
                      onDrag={handleDrag(photo.id)}
                      onDragEnd={handleDragEnd(photo.id)}
                      whileDrag={{
                        scale: 1.12,
                        boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
                      }}
                      initial={{ opacity: 0, scale: 0.4, y: -20 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.4 }}
                      style={{
                        // The invisible "slot" remains fixed so drag-and-drop math works perfectly
                        width: ITEM_WIDTH, 
                        flexShrink: 0,
                        touchAction: "none",
                        zIndex: isBeingDragged ? 50 : 1,
                        display: "flex",
                        justifyContent: "center", // Perfectly centers the dynamic-width polaroid in its slot
                      }}
                      className="relative cursor-grab active:cursor-grabbing"
                      onDragOver={handleFileDragOver(index)}
                      onDragLeave={handleFileDragLeave(index)}
                      onDrop={handleFileDrop(index)}
                    >
                      <motion.div
                        animate={{
                          y: hangOffset(i, rowPhotos.length),
                          rotate: photo.tilt,
                        }}
                        transition={{ type: "spring", stiffness: 260, damping: 24 }}
                        className="relative pointer-events-none"
                        style={{ width: clampedWidth }} // Apply the dynamic width here
                      >
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 rotate-[-3deg]">
                          <div className="w-4 h-8 rounded-[2px] bg-gradient-to-b from-[#cfa872] to-[#9c7443] shadow-md relative">
                            <div className="absolute inset-x-0 top-1/2 h-[2px] bg-[#6f4f2c]/70" />
                            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-black/10" />
                            <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white/20" />
                          </div>
                        </div>

                        <div className="absolute -top-3 -left-3 z-20 w-6 h-6 rounded-full bg-black/80 text-white text-[12px] font-bold flex items-center justify-center border border-white/70 shadow-sm">
                          {index + 1}
                        </div>

                        <div
                          className={
                            "bg-white p-3 pb-9 shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition-shadow pointer-events-auto " +
                            (isFileDragTarget || isReorderTarget
                              ? "ring-4 ring-pink-400 ring-offset-2"
                              : "")
                          }
                          onDoubleClick={() => {
                            fileInputTarget.current = index;
                            document.getElementById("photo-string-file-input")?.click();
                          }}
                          title="Drag a photo here, or double-click to replace"
                        >
                          <div
                            className="w-full overflow-hidden bg-gradient-to-br from-neutral-800 to-black"
                            style={{ aspectRatio: photo.aspect || 1 }}
                          >
                            {photo.url ? (
                              <img
                                src={photo.url}
                                alt={`Favorite photo, rank ${index + 1}`}
                                className="w-full h-full object-cover pointer-events-none select-none"
                                draggable={false}
                              />
                            ) : null}
                          </div>
                        </div>

                        {(isFileDragTarget || isReorderTarget) && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[12px] font-bold text-pink-600 bg-white/90 px-3 py-1 rounded shadow-md">
                              {isFileDragTarget ? "Insert here" : "Drop here"}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      <input
        id="photo-string-file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      <p className="relative z-10 text-center text-sm text-neutral-500 font-medium mt-16 max-w-lg px-6">
        Drag a photo anywhere across both strings to change your rankings. Drop an
        image file from your computer onto any slot to insert it there — the photo
        in 10th place drops off.
      </p>
    </div>
  );
}