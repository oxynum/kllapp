"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Check, X, CircleNotch } from "@phosphor-icons/react";
import { KllappLogo } from "@/components/ui/kllapp-logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  getDeskAvailability,
  bookDesk,
  cancelDeskBooking,
} from "@/app/(dashboard)/workplace/actions";
import { getFloorPlans, getFloorPlanWithDesks } from "@/app/(dashboard)/workplace/floor-plan/actions";
import { DeskAvailabilityLegend } from "@/components/desk-booking/desk-availability-legend";
import type { FloorPlanElement, DeskBookingStatus } from "@/types";

// Dynamic import for Konva canvas
const DeskBookingCanvas = dynamic(
  () =>
    import("@/components/desk-booking/desk-booking-canvas").then((mod) => ({
      default: mod.DeskBookingCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        Chargement...
      </div>
    ),
  }
);

interface BookableDesk {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  status: DeskBookingStatus;
  bookedByUserName?: string | null;
  bookedByUserImage?: string | null;
}

interface DeskBookingPanelProps {
  userId: string;
  date: string;
  workplaceId: string;
  userName: string;
  userImage?: string | null;
  currentUserId: string;
  onClose: () => void;
}

export function DeskBookingPanel({
  userId,
  date,
  workplaceId,
  userName,
  userImage,
  currentUserId,
  onClose,
}: DeskBookingPanelProps) {
  const t = useTranslations("deskBooking");
  const [isPending, startTransition] = useTransition();

  const [floors, setFloors] = useState<{ id: string; name: string; floorNumber: number }[]>([]);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [layout, setLayout] = useState<FloorPlanElement[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [desks, setDesks] = useState<BookableDesk[]>([]);
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Load floor plans and availability
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const allFloors = await getFloorPlans(workplaceId);
        if (cancelled) return;

        if (allFloors.length === 0) {
          setError("noFloorPlan");
          setLoading(false);
          return;
        }

        setFloors(allFloors.map((f) => ({ id: f.id, name: f.name, floorNumber: f.floorNumber })));
        const firstFloor = allFloors[0];
        setActiveFloorId(firstFloor.id);
        await loadFloorData(firstFloor.id);
      } catch {
        if (!cancelled) setError("Failed to load floor plans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadFloorData(floorId: string) {
      const [planData, availability] = await Promise.all([
        getFloorPlanWithDesks(floorId),
        getDeskAvailability({ floorPlanId: floorId, date }),
      ]);

      if (cancelled || !planData) return;

      setLayout(planData.layout);
      setCanvasSize({ width: planData.width, height: planData.height });

      const desksWithStatus: BookableDesk[] = availability.map((d) => {
        let status: DeskBookingStatus = "available";
        if (!d.isAvailable) {
          status = "unavailable";
        } else if (d.bookedByUserId === userId) {
          status = "yours";
          setSelectedDeskId(d.id);
        } else if (d.bookedByUserId) {
          status = "booked";
        }
        return {
          id: d.id, label: d.label,
          x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation,
          status, bookedByUserName: d.bookedByUserName, bookedByUserImage: d.bookedByUserImage,
        };
      });

      setDesks(desksWithStatus);
    }

    load();
    return () => { cancelled = true; };
  }, [workplaceId, date, userId]);

  const handleSelectDesk = useCallback(
    (deskId: string) => {
      setSelectedDeskId(selectedDeskId === deskId ? null : deskId);
    },
    [selectedDeskId]
  );

  const handleConfirm = useCallback(() => {
    if (!selectedDeskId) return;
    startTransition(async () => {
      try {
        const existingBooking = desks.find((d) => d.status === "yours");
        if (existingBooking && existingBooking.id !== selectedDeskId) {
          await cancelDeskBooking({ userId, date });
        }
        await bookDesk({ deskId: selectedDeskId, userId, date });
        setDesks((prev) =>
          prev.map((d) => {
            if (d.id === selectedDeskId) return { ...d, status: "yours" as DeskBookingStatus, bookedByUserName: userName };
            if (d.status === "yours") return { ...d, status: "available" as DeskBookingStatus, bookedByUserName: null };
            return d;
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Booking failed");
      }
    });
  }, [selectedDeskId, userId, date, desks, userName, startTransition]);

  const handleCancel = useCallback(() => {
    startTransition(async () => {
      try {
        await cancelDeskBooking({ userId, date });
        setDesks((prev) =>
          prev.map((d) =>
            d.status === "yours"
              ? { ...d, status: "available" as DeskBookingStatus, bookedByUserName: null }
              : d
          )
        );
        setSelectedDeskId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cancel failed");
      }
    });
  }, [userId, date, startTransition]);

  const handleFloorChange = useCallback(
    async (floorId: string) => {
      if (floorId === activeFloorId) return;
      setActiveFloorId(floorId);
      setLoading(true);
      setSelectedDeskId(null);
      try {
        const [planData, availability] = await Promise.all([
          getFloorPlanWithDesks(floorId),
          getDeskAvailability({ floorPlanId: floorId, date }),
        ]);
        if (!planData) return;
        setLayout(planData.layout);
        setCanvasSize({ width: planData.width, height: planData.height });
        setDesks(
          availability.map((d) => {
            let status: DeskBookingStatus = "available";
            if (!d.isAvailable) status = "unavailable";
            else if (d.bookedByUserId === userId) { status = "yours"; setSelectedDeskId(d.id); }
            else if (d.bookedByUserId) status = "booked";
            return { id: d.id, label: d.label, x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation, status, bookedByUserName: d.bookedByUserName, bookedByUserImage: d.bookedByUserImage };
          })
        );
      } finally { setLoading(false); }
    },
    [activeFloorId, date, userId]
  );

  const hasExistingBooking = desks.some((d) => d.status === "yours");
  const selectedDesk = desks.find((d) => d.id === selectedDeskId);
  const isNewSelection = selectedDeskId && selectedDesk?.status === "available";

  // Format date for display
  const dateDisplay = new Date(date + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{
        backgroundColor: "#f9fafb",
        backgroundImage: "radial-gradient(circle, #d1d5db 0.8px, transparent 0.8px)",
        backgroundSize: "20px 20px",
      }}
    >
      {/* ─── Close button (top-right) ─── */}
      <button
        onClick={onClose}
        className="fixed right-5 top-5 z-[71] flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
      >
        <X size={18} weight="bold" />
      </button>

      {/* ─── Minimal top bar ─── */}
      <div className="flex items-center gap-4 px-6 py-3">
        <KllappLogo className="h-4 w-auto" />
        <span className="text-xs text-gray-200">|</span>
        <div className="flex items-center gap-2">
          <UserAvatar name={userName} image={userImage} size={22} />
          <span className="text-sm font-medium text-gray-900">{userName}</span>
        </div>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-sm capitalize text-gray-500">{dateDisplay}</span>

        {floors.length > 1 && (
          <>
            <span className="text-xs text-gray-300">·</span>
            <div className="flex items-center gap-1">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  onClick={() => handleFloorChange(floor.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeFloorId === floor.id
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {floor.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Canvas (full area) ─── */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
      >
        {loading ? (
          <div className="flex h-full w-full items-center justify-center">
            <CircleNotch size={28} className="animate-spin text-gray-300" />
          </div>
        ) : error === "noFloorPlan" ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            {t("noFloorPlan")}
          </div>
        ) : (
          <DeskBookingCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            layout={layout}
            desks={desks}
            selectedDeskId={selectedDeskId}
            onSelectDesk={handleSelectDesk}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        )}
      </div>

      {/* ─── Bottom bar (minimal) ─── */}
      <div className="flex items-center justify-between px-6 py-2.5">
        <DeskAvailabilityLegend />

        {error && error !== "noFloorPlan" && (
          <div className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          {selectedDeskId && selectedDesk && (
            <span className="text-sm text-gray-500">
              {selectedDesk.label}
            </span>
          )}
          {hasExistingBooking && (
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          )}
          {isNewSelection && (
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {isPending ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {t("confirm")}
            </button>
          )}
          {!selectedDeskId && !hasExistingBooking && (
            <span className="text-xs text-gray-300">{t("selectDesk")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
