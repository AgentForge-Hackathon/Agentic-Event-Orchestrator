import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { AuthenticatedHome } from '@/components/home/AuthenticatedHome';

export function Index() {
  const { user } = useAuth();

  return (
    <>
      <Header />
      <main className="min-h-screen">
        {user ? <AuthenticatedHome /> : <HeroSection />}
      </main>
      <Footer />
    </>
  );
}
