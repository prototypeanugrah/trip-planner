import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TripService } from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, ArrowRight } from 'lucide-react';
import { CreateTripWizard } from '@/components/CreateTripWizard';
import { Link } from 'react-router-dom';

export function Home() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: TripService.getAll,
  });

  if (isLoading) {
      return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!trips || trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-fade-in">
        <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Start planning your next adventure</h1>
            <p className="text-text-secondary text-lg max-w-md mx-auto">
                Collaborate with friends, vote on destinations, and create the perfect itinerary together.
            </p>
        </div>
        <Button size="lg" onClick={() => setIsWizardOpen(true)} className="h-14 px-8 text-lg">
            <Plus className="mr-2 h-5 w-5" />
            Create New Trip
        </Button>
        <CreateTripWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Your Trips</h1>
            <Button onClick={() => setIsWizardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Trip
            </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
                <Link key={trip.id} to={`/trip/${trip.id}`} className="group block">
                    <Card className="h-full transition-all hover:border-accent-blue hover:-translate-y-1">
                        <CardHeader>
                            <CardTitle className="group-hover:text-accent-blue transition-colors">{trip.name}</CardTitle>
                            <CardDescription>{new Date(trip.target_start_date).toLocaleDateString()} • {trip.status}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-text-secondary line-clamp-2 mb-4">{trip.description}</p>
                            <div className="flex items-center text-sm font-medium text-accent-blue">
                                Open Dashboard <ArrowRight className="ml-1 w-4 h-4" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
        <CreateTripWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
}

