import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, MapPin } from "lucide-react";

export default function About() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-20 w-full"
    >
      <header className="mb-12">
        <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-4">
          About
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-medium leading-tight">
          A growing archive of Black visual artists.
        </h1>
      </header>

      <div className="space-y-10 text-lg leading-relaxed text-foreground/90">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary/70" />
            <h2 className="font-serif text-2xl font-medium">Where this list came from</h2>
          </div>
          <p>
            The artists featured here were drawn from Wikipedia&rsquo;s{" "}
            <a
              href="https://en.wikipedia.org/wiki/List_of_African-American_visual_artists"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              &ldquo;List of African-American visual artists&rdquo;
            </a>
            , a community-maintained catalog that draws on encyclopedic sources spanning
            more than two centuries of Black American visual art. Each entry is linked to
            its source Wikipedia article so you can dig deeper than what we surface here.
          </p>
          <p>
            To that list we&rsquo;ve added a small number of hand-curated artists
            who aren&rsquo;t currently on the Wikipedia page but belong in the conversation
            &mdash; figures whose work has shaped the field even when mainstream
            catalogs have lagged behind.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary/70" />
            <h2 className="font-serif text-2xl font-medium">What we&rsquo;re trying to build</h2>
          </div>
          <p>
            This is a deliberate work in progress. The intention is for the archive to grow
            in two directions at once:
          </p>
          <ul className="space-y-3 pl-2">
            <li className="flex gap-3">
              <span className="text-primary/60 shrink-0 mt-1">•</span>
              <span>
                <strong>More artists.</strong> Both more artists from the past
                &mdash; figures whose contributions have been under-documented
                &mdash; and more contemporary artists out there working right now.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary/60 shrink-0 mt-1">•</span>
              <span>
                <strong>More examples of each artist&rsquo;s work.</strong> For every
                artist already listed, we want to surface additional pieces
                &mdash; paintings, sculptures, photographs, installations
                &mdash; so the archive becomes a richer visual record, not just a
                name on a page.
              </span>
            </li>
          </ul>
          <p>
            Some of that growth will come from public-domain and open-access sources
            (museum collections, the Wikimedia ecosystem, archival projects). Some of it
            will require working through rights questions case by case. Either way, every
            image we publish keeps its source attribution and license so you can trace it
            back to where it came from.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-primary/70" />
            <h2 className="font-serif text-2xl font-medium">How to explore</h2>
          </div>
          <p>
            The archive offers four ways in, each suited to a different kind of looking:
          </p>
          <ul className="space-y-3 pl-2">
            <li className="flex gap-3">
              <span className="text-primary/60 shrink-0 mt-1">•</span>
              <span>
                <Link href="/gallery" className="underline decoration-primary/40 underline-offset-4 hover:decoration-primary font-medium">
                  Gallery
                </Link>{" "}
                &mdash; a flat alphabetical browse of every artist.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary/60 shrink-0 mt-1">•</span>
              <span>
                <Link href="/timeline" className="underline decoration-primary/40 underline-offset-4 hover:decoration-primary font-medium">
                  Timeline
                </Link>{" "}
                &mdash; chronological view organized by decade.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-primary/60 shrink-0 mt-1">•</span>
              <span>
                <Link href="/movements" className="underline decoration-primary/40 underline-offset-4 hover:decoration-primary font-medium">
                  Movements
                </Link>{" "}
                &mdash; grouped by era and collective (Harlem Renaissance, WPA
                Social Realism, Spiral Group, Black Arts Movement, and more).
              </span>
            </li>
          </ul>
        </section>

        <section className="pt-6 border-t border-border/40 text-base text-muted-foreground space-y-3">
          <p>
            Artist biographies are sourced from Wikipedia. Gallery cards and detail-page
            artwork images are drawn from Wikipedia&rsquo;s open-access media, the
            Metropolitan Museum of Art&rsquo;s Open Access collection (CC0), and the
            Art Institute of Chicago&rsquo;s API. Each image retains its source
            attribution and license.
          </p>
          <p>
            The archive is open-source. You can follow the work, suggest artists to
            include, or see how the data is built at{" "}
            <a
              href="https://github.com/EyeSeeThru/artist-portal"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              github.com/EyeSeeThru/artist-portal
            </a>
            .
          </p>
        </section>
      </div>
    </motion.div>
  );
}
