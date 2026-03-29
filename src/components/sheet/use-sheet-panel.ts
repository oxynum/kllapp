import { useState, useCallback } from "react";
import type { PanelMode } from "@/types";

export function useSheetPanel() {
  const [panelState, setPanelState] = useState<PanelMode>({ type: "closed" });

  const openAssignUser = useCallback(
    (projectId: string, projectName: string, clientName: string) => {
      setPanelState({ type: "assign-user", projectId, projectName, clientName });
    },
    []
  );

  const openAddProject = useCallback(
    (clientId: string, clientName: string) => {
      setPanelState({ type: "add-project", clientId, clientName });
    },
    []
  );

  const openAddClient = useCallback(() => {
    setPanelState({ type: "add-client" });
  }, []);

  const openUserDetail = useCallback(
    (userId: string, projectId: string, userName: string) => {
      setPanelState({ type: "user-detail", userId, projectId, userName });
    },
    []
  );

  const openAddUser = useCallback(() => {
    setPanelState({ type: "add-user" });
  }, []);

  const openAddSubProject = useCallback(
    (projectId: string, projectName: string, clientName: string) => {
      setPanelState({ type: "add-sub-project", projectId, projectName, clientName });
    },
    []
  );

  const openProjectDetail = useCallback(
    (projectId: string, projectName: string, clientName: string) => {
      setPanelState({ type: "project-detail", projectId, projectName, clientName });
    },
    []
  );

  const openClientDetail = useCallback(
    (clientId: string, clientName: string) => {
      setPanelState({ type: "client-detail", clientId, clientName });
    },
    []
  );

  const openAddAbsenceClient = useCallback(() => {
    setPanelState({ type: "add-absence-client" });
  }, []);

  const openAddAbsenceType = useCallback(
    (clientId: string, clientName: string) => {
      setPanelState({ type: "add-absence-type", clientId, clientName });
    },
    []
  );

  const openAssignAbsenceUser = useCallback(
    (projectId: string, projectName: string, clientName: string) => {
      setPanelState({ type: "assign-absence-user", projectId, projectName, clientName });
    },
    []
  );

  const openAbsenceClientDetail = useCallback(
    (clientId: string, clientName: string) => {
      setPanelState({ type: "absence-client-detail", clientId, clientName });
    },
    []
  );

  const openAbsenceTypeDetail = useCallback(
    (projectId: string, projectName: string, clientName: string) => {
      setPanelState({ type: "absence-type-detail", projectId, projectName, clientName });
    },
    []
  );

  const openAddCalendar = useCallback(() => {
    setPanelState({ type: "add-calendar" });
  }, []);

  const openCalendarDetail = useCallback(
    (integrationId: string, integrationLabel: string) => {
      setPanelState({ type: "calendar-detail", integrationId, integrationLabel });
    },
    []
  );

  const openCalendarEvents = useCallback(
    (integrationId: string, integrationLabel: string, date: string) => {
      setPanelState({ type: "calendar-events", integrationId, integrationLabel, date });
    },
    []
  );

  const openDeskBooking = useCallback(
    (userId: string, date: string, workplaceId: string, userName: string) => {
      setPanelState({ type: "desk-booking", userId, date, workplaceId, userName });
    },
    []
  );

  const closePanel = useCallback(() => {
    setPanelState({ type: "closed" });
  }, []);

  return {
    panelState,
    openAssignUser,
    openAddProject,
    openAddClient,
    openUserDetail,
    openAddUser,
    openAddSubProject,
    openProjectDetail,
    openClientDetail,
    openAddAbsenceClient,
    openAddAbsenceType,
    openAssignAbsenceUser,
    openAbsenceClientDetail,
    openAbsenceTypeDetail,
    openAddCalendar,
    openCalendarDetail,
    openCalendarEvents,
    openDeskBooking,
    closePanel,
    isOpen: panelState.type !== "closed",
  };
}
