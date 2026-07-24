import { Link } from "wouter";
import { motion } from "framer-motion";
import { Compass, Search, ImageIcon, Clock, Layers } from "lucide-react";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24 w-full"
    >
      <div className="mb-12">
        <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-4">
          Error 404
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium leading-tight mb-6">
          That page isn't in the archive.
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          The link may be out of date, or the page may have been moved. Here are the
          main ways to keep exploring:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
          <Compass className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
          <div>
            <h3 className="font-medium text-lg">Home</h3>
            <p className="text-sm text-muted-foreground">Featured artist & entry points</p>
          </div>
        </Link>

        <Link href="/artist-index" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
          <Search className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
          <div>
            <h3 className="font-medium text-lg">Artist Index</h3>
            <p className="text-sm text-muted-foreground">Browse all artists alphabetically</p>
          </div>
        </Link>

        <Link href="/gallery" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
          <ImageIcon className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
          <div>
            <h3 className="font-medium text-lg">Gallery</h3>
            <p className="text-sm text-muted-foreground">Works from the archive</p>
          </div>
        </Link>

        <Link href="/timeline" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
          <Clock className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
          <div>
            <h3 className="font-medium text-lg">Timeline</h3>
            <p className="text-sm text-muted-foreground">Chronological view</p>
          </div>
        </Link>

        <Link href="/movements" className="group p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors flex flex-col gap-3">
          <Layers className="w-6 h-6 text-primary/60 group-hover:text-primary transition-colors" />
          <div>
            <h3 className="font-medium text-lg">Movements</h3>
            <p className="text-sm text-muted-foreground">By era and collective</p>
          </div>
        </Link>
      </div>
    </motion.div>
  );
}
