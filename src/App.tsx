import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./routes/Home";
import { tools } from "./tools/registry";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        {tools.map((tool) => (
          <Route
            key={tool.id}
            path={tool.path}
            element={
              <Suspense fallback={<p>Loading…</p>}>
                <tool.component />
              </Suspense>
            }
          />
        ))}
      </Route>
    </Routes>
  );
}
