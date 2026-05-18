import { useEffect, useRef, useCallback } from "react";
import {
  open as openModal,
  close as closeModal,
  mount as mountWidget,
  type ArtIDOpenOptions,
  type ArtIDMountOptions,
  type ArtIDRegisteredDetail,
} from "@artidv1/widget";

export type { ArtIDOpenOptions, ArtIDMountOptions, ArtIDRegisteredDetail };
export { openModal as open, closeModal as close };

export interface ArtIDButtonProps extends ArtIDMountOptions {
  className?: string;
  children?: React.ReactNode;
  onRegistered?: (detail: ArtIDRegisteredDetail) => void;
}

/**
 * Renders the gilded museum-passport button inline. Click opens the modal/iframe.
 */
export function ArtIDButton({
  collection,
  tokenId,
  host,
  label,
  className,
  children,
  onRegistered,
}: ArtIDButtonProps) {
  const onClick = useCallback(() => {
    openModal({ collection, tokenId, host });
  }, [collection, tokenId, host]);

  useArtIDRegistered(onRegistered);

  if (children || className) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children ?? label ?? "Mint Museum Passport"}
      </button>
    );
  }
  return <MountedButton collection={collection} tokenId={tokenId} host={host} label={label} />;
}

function MountedButton({ collection, tokenId, host, label }: ArtIDMountOptions) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const cleanup = mountWidget(ref.current, { collection, tokenId, host, label });
    return cleanup;
  }, [collection, tokenId, host, label]);
  return <span ref={ref} />;
}

/**
 * Mounts the widget into a `<div>` — pass props once, button auto-renders.
 */
export function ArtIDWidget(props: ArtIDMountOptions & { onRegistered?: (d: ArtIDRegisteredDetail) => void }) {
  const { onRegistered, ...rest } = props;
  useArtIDRegistered(onRegistered);
  return <MountedButton {...rest} />;
}

/**
 * Hook — opens the modal imperatively, returns `open` + `close`.
 */
export function useArtID() {
  return { open: openModal, close: closeModal };
}

function useArtIDRegistered(cb?: (d: ArtIDRegisteredDetail) => void) {
  useEffect(() => {
    if (!cb) return;
    const handler = (e: Event) => cb((e as CustomEvent<ArtIDRegisteredDetail>).detail);
    window.addEventListener("artid:registered", handler as EventListener);
    return () => window.removeEventListener("artid:registered", handler as EventListener);
  }, [cb]);
}
