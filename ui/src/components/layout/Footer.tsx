import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-background/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Compass className="h-5 w-5 text-primary" aria-hidden="true" />
              Planly
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered event planning for unforgettable experiences.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm">Quick Links</h3>
            <Link to="/events" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Events
            </Link>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm">Support</h3>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Help Center
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact Us
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold text-sm">Connect</h3>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Twitter
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Instagram
            </a>
          </div>
        </div>

        <div className="border-t pt-8">
          <p className="text-sm text-muted-foreground">
            © 2026 Planly. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
