import ManagerSidebar from "./ManagerSidebar";
import ManagerHeader from "./ManagerHeader";

export default function ManagerLayout({
  title,
  description,
  children,
  headerVariant = "user",
  pageClassName = "",
  headerIcon = "",
}) {
  const pageClass = [
    "manager-page",
    headerVariant === "profile" ? "manager-page-profile" : "manager-page-compact",
    pageClassName,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={`app-container ${pageClass}`}>
      <ManagerSidebar />
      <main className="main-content">
        <ManagerHeader
          title={title}
          description={description}
          variant={headerVariant}
          icon={headerIcon}
        />
        <div className="content-wrapper">{children}</div>
      </main>
    </div>
  );
}
