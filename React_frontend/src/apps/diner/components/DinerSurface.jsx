import dinerStyles from "../styles/index.css?inline";
import mapStyles from "leaflet/dist/leaflet.css?inline";

// CSS scopes isolate actor styles while children render as ordinary components.
export default function DinerSurface({ children }) {
  return (
    <div className="diner-surface">
      <style>{`${dinerStyles}\n${mapStyles}\n.diner-surface { display: block; width: 100%; }`}</style>
      {children}
    </div>
  );
}
