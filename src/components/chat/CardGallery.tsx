"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UniversityCard } from "@/components/cards/UniversityCard";
import { DirectionCard } from "@/components/cards/DirectionCard";
import { GrantCard } from "@/components/cards/GrantCard";
import { NewsCard } from "@/components/cards/NewsCard";

interface CardGalleryProps {
  items: any[];
  type: "university" | "direction" | "grant" | "news";
}

export function CardGallery({ items, type }: CardGalleryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollStart, setScrollStart] = useState(0);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 10);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }
  };

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (el) {
      const amount = el.clientWidth * 0.6;
      el.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollStart(scrollRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollStart - walk;
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", updateScrollButtons);
      updateScrollButtons();
      return () => el.removeEventListener("scroll", updateScrollButtons);
    }
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <div className="relative my-3 group">
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-110"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className={`flex gap-3 overflow-x-auto pb-2 custom-scrollbar ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((item: any, idx: number) => (
          <div
            key={idx}
            className="flex-shrink-0 w-[280px] sm:w-[300px]"
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="message-stagger" style={{ animationDelay: `${idx * 80}ms` }}>
              {type === "university" && <UniversityCard university={item} />}
              {type === "direction" && <DirectionCard direction={item} />}
              {type === "grant" && <GrantCard grant={item} />}
              {type === "news" && <NewsCard news={item} />}
            </div>
          </div>
        ))}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-110"
        >
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      )}

      {/* Scroll Indicator */}
      <div className="flex justify-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          {items.slice(0, Math.min(items.length, 7)).map((_, idx) => (
            <div
              key={idx}
              className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 transition-all duration-300"
              style={{
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
