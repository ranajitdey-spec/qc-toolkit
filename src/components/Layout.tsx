import { NavLink, Outlet } from "react-router-dom";
import { tools } from "../tools/registry";
import styles from "./Layout.module.css";

export default function Layout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink to="/" className={styles.brand}>
          QC Toolkit
        </NavLink>
        <nav className={styles.nav}>
          {tools.map((tool) => (
            <NavLink
              key={tool.id}
              to={tool.path}
              className={({ isActive }) => (isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink)}
            >
              {tool.name}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
