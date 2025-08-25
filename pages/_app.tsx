import "../styles/globals.css";
import type { AppProps } from "next/app";
import NavBar from "../components/NavBar";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
