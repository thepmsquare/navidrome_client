import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

interface PlayerOverlayContextValue {
  bottomBarHeight: number;
  setBottomBarHeight: (height: number) => void;
  miniPlayerHeight: number;
  setMiniPlayerHeight: (height: number) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  expandPlayer: () => void;
  collapsePlayer: () => void;
  registerHandlers: (expand: () => void, collapse: () => void) => void;
}

const PlayerOverlayContext = createContext<PlayerOverlayContextValue>({
  bottomBarHeight: 0,
  setBottomBarHeight: () => {},
  miniPlayerHeight: 67,
  setMiniPlayerHeight: () => {},
  isExpanded: false,
  setIsExpanded: () => {},
  expandPlayer: () => {},
  collapsePlayer: () => {},
  registerHandlers: () => {},
});

export function PlayerOverlayProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const [miniPlayerHeight, setMiniPlayerHeight] = useState(67);
  const [isExpanded, setIsExpanded] = useState(false);

  const expandHandlerRef = useRef<() => void>(() => setIsExpanded(true));
  const collapseHandlerRef = useRef<() => void>(() => setIsExpanded(false));

  const registerHandlers = useCallback(
    (expand: () => void, collapse: () => void) => {
      expandHandlerRef.current = expand;
      collapseHandlerRef.current = collapse;
    },
    [],
  );

  const expandPlayer = useCallback(() => {
    expandHandlerRef.current();
  }, []);

  const collapsePlayer = useCallback(() => {
    collapseHandlerRef.current();
  }, []);

  return (
    <PlayerOverlayContext.Provider
      value={{
        bottomBarHeight,
        setBottomBarHeight,
        miniPlayerHeight,
        setMiniPlayerHeight,
        isExpanded,
        setIsExpanded,
        expandPlayer,
        collapsePlayer,
        registerHandlers,
      }}
    >
      {children}
    </PlayerOverlayContext.Provider>
  );
}

export function usePlayerOverlay() {
  return useContext(PlayerOverlayContext);
}
