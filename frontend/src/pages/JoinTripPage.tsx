import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TripService } from '@/services/api';
import { Input } from '@/components/ui/Input';
import { LocationInput } from '@/components/ui/LocationInput';
import { Button } from '@/components/ui/Button';
import { RadioCard, RadioCardGroup } from '@/components/ui/RadioGroup';
import { cn } from '@/lib/utils';
import { 
    Coins, 
    Palmtree, 
    Landmark, 
    Mountain, 
    PartyPopper, 
    Store, 
    Moon, 
    ShoppingBag, 
    Sparkles 
} from 'lucide-react';

const joinSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits").optional().or(z.literal('')),
  location: z.string().optional(),
  budget: z.enum(['low', 'medium', 'high']),
  preferences: z.array(z.string()).min(1, "Select at least one preference"),
});

type JoinForm = z.infer<typeof joinSchema>;

export function JoinTripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(true);

  const { register, handleSubmit, setValue, control, formState: { errors }, watch } = useForm<JoinForm>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
        preferences: [],
        budget: 'medium',
        name: '',
        phone: '',
    }
  });

  const preferences = useWatch({ control, name: 'preferences' });
  const phone = useWatch({ control, name: 'phone' });

  // Fetch existing participants to check if user is already in trip
  const { data: participants, isLoading: isLoadingParticipants } = useQuery({
    queryKey: ['participants', tripId],
    queryFn: () => tripId ? TripService.getParticipants(tripId) : Promise.resolve([]),
    enabled: !!tripId && !!user?.primaryEmailAddress?.emailAddress
  });

  useEffect(() => {
    if (!isLoadingParticipants && participants && user?.primaryEmailAddress?.emailAddress) {
      const userEmail = user.primaryEmailAddress.emailAddress;
      const existingParticipant = participants.find(p => p.email === userEmail);
      
      if (existingParticipant) {
        // If the user is already a participant and NOT a placeholder (name != "Invited User"),
        // then they have already joined. Redirect them.
        if (existingParticipant.name !== "Invited User") {
            navigate(`/trip/${tripId}`);
            return;
        }
        // If they are "Invited User", they are claiming their spot. 
        // Pre-fill phone if available on the placeholder
        if (existingParticipant.phone) {
            setValue('phone', existingParticipant.phone);
        }
      }
      setIsChecking(false);
    } else if (!isLoadingParticipants) {
        setIsChecking(false);
    }
  }, [participants, isLoadingParticipants, user, navigate, tripId, setValue]);

  // Pre-fill form with user data if available
  useEffect(() => {
      if (user) {
          if (user.fullName) setValue('name', user.fullName);
      }
  }, [user, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: JoinForm) => {
      if (!tripId) throw new Error("Trip ID is missing");
      return await TripService.joinTrip(tripId, {
          ...data,
          email: user?.primaryEmailAddress?.emailAddress,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants', tripId] });
      navigate(`/trip/${tripId}`);
    }
  });

  const onSubmit = (data: JoinForm) => {
    mutation.mutate(data);
  };

  const togglePreference = (value: string) => {
    const current = preferences || [];
    if (current.includes(value)) {
        setValue('preferences', current.filter(p => p !== value));
    } else {
        setValue('preferences', [...current, value]);
    }
  };

  if (!tripId) return <div>Invalid Trip Link</div>;
  
  if (isLoadingParticipants || isChecking) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
            <div className="text-text-secondary">Checking trip status...</div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-bg-secondary rounded-2xl shadow-xl p-8 border border-border">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Join Trip</h1>
            <p className="text-text-secondary mb-8">Complete your profile to join the trip.</p>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <Input 
                    label="Name" 
                    placeholder="Your Name" 
                    {...register('name')} 
                    error={errors.name?.message}
                    className="capitalize"
                />
                <Input 
                    label="Phone" 
                    placeholder="10 digit number" 
                    type="tel"
                    {...register('phone')} 
                    error={phone && phone.length > 10 ? `You have entered ${phone.length} digits. Please enter a 10 digit number` : errors.phone?.message}
                />
                <Controller
                    name="location"
                    control={control}
                    render={({ field }) => (
                        <LocationInput 
                            label="Current Location" 
                            placeholder="e.g. New York" 
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.location?.message}
                        />
                    )}
                />
                
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="block text-lg font-semibold text-text-primary">What is Your Budget?</label>
                        <p className="text-sm text-text-secondary">The budget is exclusively allocated for activities and dining purposes.</p>
                    </div>
                    <RadioCardGroup 
                        value={watch('budget')} 
                        onChange={(val: string) => setValue('budget', val as 'low' | 'medium' | 'high')}
                        className="grid-cols-3 gap-3"
                    >
                        <RadioCard 
                            value="low" 
                            title="Low" 
                            description="0 - 1000 USD" 
                            icon={<Coins className="w-6 h-6" />}
                        />
                        <RadioCard 
                            value="medium" 
                            title="Medium" 
                            description="1000 - 2500 USD" 
                            icon={<Coins className="w-6 h-6" />}
                        />
                        <RadioCard 
                            value="high" 
                            title="High" 
                            description="2500+ USD" 
                            icon={<Coins className="w-6 h-6" />}
                        />
                    </RadioCardGroup>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">Preferences</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                            { id: 'beaches', label: 'Beaches', icon: Palmtree },
                            { id: 'city_sightseeing', label: 'City sightseeing', icon: Landmark },
                            { id: 'outdoor_adventures', label: 'Outdoor adventures', icon: Mountain },
                            { id: 'festivals_events', label: 'Festivals/events', icon: PartyPopper },
                            { id: 'food_exploration', label: 'Food exploration', icon: Store },
                            { id: 'nightlife', label: 'Nightlife', icon: Moon },
                            { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
                            { id: 'spa_wellness', label: 'Spa wellness', icon: Sparkles },
                        ].map(p => (
                            <div 
                                key={p.id}
                                onClick={() => togglePreference(p.id)}
                                className={cn(
                                    "cursor-pointer rounded-xl border p-3 transition-all select-none flex flex-col items-center justify-center gap-2 h-24 text-center group",
                                    preferences?.includes(p.id)
                                        ? "bg-accent-blue/10 border-accent-blue text-accent-blue"
                                        : "bg-input-bg border-border hover:bg-bg-tertiary hover:border-accent-blue/30"
                                )}
                            >
                                <p.icon 
                                    className={cn(
                                        "w-6 h-6 transition-colors", 
                                        preferences?.includes(p.id) ? "text-accent-blue" : "text-text-secondary group-hover:text-accent-blue"
                                    )} 
                                    strokeWidth={1.5}
                                />
                                <span className={cn(
                                    "text-sm font-medium",
                                    preferences?.includes(p.id) ? "text-accent-blue" : "text-text-primary"
                                )}>
                                    {p.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    {errors.preferences && <p className="text-sm text-red-500">{errors.preferences.message}</p>}
                </div>

                <div className="flex justify-end">
                    <Button type="submit" isLoading={mutation.isPending} size="lg">
                        Join Trip
                    </Button>
                </div>
            </form>
        </div>
    </div>
  );
}
