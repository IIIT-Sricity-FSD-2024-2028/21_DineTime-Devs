import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dinerStyles from "../styles/index.css?inline";
import mapStyles from "leaflet/dist/leaflet.css?inline";

// The existing actor apps load global styles with shared class names. A shadow
// boundary keeps those rules out while all diner content remains React JSX.
export default function DinerSurface({ children }) {
  const host = useRef(null);
  const [root, setRoot] = useState(null);
  useLayoutEffect(() => {
    setRoot(
      host.current.shadowRoot || host.current.attachShadow({ mode: "open" }),
    );
  }, []);
  return (
    <div ref={host} className="diner-surface">
      {root &&
        createPortal(
          <>
            <style>{`${dinerStyles}\n${mapStyles}\n:host { display: block; width: 100%; }`}</style>
            {children}
          </>,
          root,
        )}
    </div>
  );
}
