import { useState, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useUser } from "@clerk/clerk-react";
import { TripService } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Wizard } from '@/components/ui/Wizard';
import { Input } from '@/components/ui/Input';
import { LocationInput } from '@/components/ui/LocationInput';
import { Button } from '@/components/ui/Button';
import { RadioCard, RadioCardGroup } from '@/components/ui/RadioGroup';
import { 
    Minus, 
    Plus, 
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
import { cn, toTitleCase } from '@/lib/utils';

const createTripSchema = z.object({
  // Step 1
  name: z.string().min(3, "Trip name is required"),
  start_date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  duration: z.number().min(1).max(60),
  
  // Step 2
  organizer_name: z.string().min(2, "Name is required"),
  organizer_phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
  organizer_email: z.string().email().optional().or(z.literal('')),
  organizer_location: z.string().optional(),

  // Step 3
  budget: z.enum(['low', 'medium', 'high']),
  preferences: z.array(z.string()).min(1, "Select at least one interest"),
});

type CreateTripForm = z.infer<typeof createTripSchema>;

interface CreateTripWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTripWizard({ isOpen, onClose }: CreateTripWizardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [step, setStep] = useState(0);

  const { register, handleSubmit, setValue, control, formState: { errors }, trigger } = useForm<CreateTripForm>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      duration: 3,
      preferences: [],
      budget: 'medium',
      start_date: new Date().toISOString().split('T')[0],
      organizer_email: user?.primaryEmailAddress?.emailAddress || "",
    },
    mode: 'onChange'
  });

  // Helpers
  const duration = useWatch({ control, name: 'duration' });
  const preferences = useWatch({ control, name: 'preferences' });
  const organizerPhone = useWatch({ control, name: 'organizer_phone' });
  const budget = useWatch({ control, name: 'budget' });

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setValue('organizer_email', user.primaryEmailAddress.emailAddress);
    }
  }, [user, setValue]);

  const createTripMutation = useMutation({
    mutationFn: async (data: CreateTripForm) => {
      // Calculate end date
      const start = new Date(data.start_date);
      const end = new Date(start);
      end.setDate(start.getDate() + data.duration);
      
        const trip = await TripService.create({
        name: data.name,
        organizer_name: toTitleCase(data.organizer_name),
        organizer_phone: data.organizer_phone,
        organizer_email: data.organizer_email || undefined,
        target_start_date: start.toISOString(),
        target_end_date: end.toISOString(),
        description: `${data.duration}-day trip to somewhere awesome`,
      });

      // Save preferences (simulated via organizer survey update)
      // In a real app, we'd probably want to do this after getting the trip ID
      // The current backend API flow for "saveOrganizerPreferences" uses PATCH /participants/{id}/survey-response
      // We need to find the organizer participant first.
      
      // We'll do this in the onSuccess or separate chain, but for now let's just return the trip
      return { trip, data };
    },
    onSuccess: async ({ trip, data }) => {
      // Ideally we should chain the preference saving here
      try {
          const participants = await TripService.getParticipants(trip.id);
          const organizer = participants.find(p => p.role === 'organizer');
          if (organizer) {
             await TripService.saveSurveyResponse(trip.id, organizer.id, {
                 location: data.organizer_location,
                 budget: data.budget,
                 preferences: data.preferences
             });
          }
      } catch (e) {
          console.error("Failed to save preferences", e);
      }

      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      onClose();
      navigate(`/trip/${trip.id}`);
    },
    onError: (error) => {
        console.error("Failed to create trip:", error);
    }
  });

  const handleNext = async () => {
    let fieldsToValidate: (keyof CreateTripForm)[] = [];
    if (step === 0) fieldsToValidate = ['name', 'start_date', 'duration'];
    if (step === 1) fieldsToValidate = ['organizer_name', 'organizer_phone', 'organizer_email'];
    
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep(s => s + 1);
  };

  const onSubmit = (data: CreateTripForm) => {
    createTripMutation.mutate(data);
  };

  const togglePreference = (value: string) => {
    const current = preferences || [];
    if (current.includes(value)) {
        setValue('preferences', current.filter(p => p !== value), { shouldValidate: true });
    } else {
        setValue('preferences', [...current, value], { shouldValidate: true });
    }
  };

  const steps = [
    {
      id: 'basics',
      title: 'Trip Details',
      component: (
        <div className="space-y-6 animate-slide-in">
          <Input 
            key="name"
            label="Trip Name" 
            placeholder="Summer 2025 Adventure" 
            {...register('name')} 
            error={errors.name?.message}
            autoFocus
          />
          
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">Duration (Days)</label>
            <div className="flex items-center gap-4">
                <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setValue('duration', Math.max(1, duration - 1))}
                >
                    <Minus className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold w-12 text-center">{duration}</span>
                <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setValue('duration', Math.min(60, duration + 1))}
                >
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
          </div>

          <Input 
            key="start_date"
            type="date"
            label="Start Date" 
            {...register('start_date')}
            error={errors.start_date?.message}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      )
    },
    {
      id: 'organizer',
      title: 'Your Info',
      component: (
        <div className="space-y-6 animate-slide-in">
           <Input 
            key="organizer_name"
            label="Your Name" 
            placeholder="Alex Doe" 
            {...register('organizer_name')} 
            error={errors.organizer_name?.message}
            autoFocus
            className="capitalize"
          />
           <Input 
            key="organizer_phone"
            label="Phone Number" 
            placeholder="1234567890" 
            type="tel"
            {...register('organizer_phone')} 
            error={organizerPhone && organizerPhone.length > 10 ? `You have entered ${organizerPhone.length} digits. Please enter a 10 digit number` : errors.organizer_phone?.message}
          />
          <Input 
            key="organizer_email"
            label="Email (Optional)" 
            placeholder="alex@example.com" 
            type="email"
            {...register('organizer_email')} 
            error={errors.organizer_email?.message}
          />
          <Controller
            name="organizer_location"
            control={control}
            render={({ field }) => (
                <LocationInput
                    key="organizer_location"
                    label="Traveling From"
                    placeholder="Austin, TX"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.organizer_location?.message}
                />
            )}
          />
        </div>
      )
    },
    {
      id: 'preferences',
      title: 'Preferences',
      component: (
        <div className="space-y-8 animate-slide-in">
           <div className="space-y-4">
                <div className="space-y-1">
                    <label className="block text-lg font-semibold text-text-primary">What is Your Budget?</label>
                    <p className="text-sm text-text-secondary">The budget is exclusively allocated for activities and dining purposes.</p>
                </div>
                <RadioCardGroup 
                    value={budget} 
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

           <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">Interests</label>
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
                    ].map(interest => (
                        <div 
                            key={interest.id}
                            onClick={() => togglePreference(interest.id)}
                            className={cn(
                                "cursor-pointer rounded-xl border p-3 transition-all select-none flex flex-col items-center justify-center gap-2 h-24 text-center group",
                                preferences.includes(interest.id)
                                    ? "bg-accent-blue/10 border-accent-blue text-accent-blue"
                                    : "bg-input-bg border-border hover:bg-bg-tertiary hover:border-accent-blue/30"
                            )}
                        >
                            <interest.icon 
                                className={cn(
                                    "w-6 h-6 transition-colors", 
                                    preferences.includes(interest.id) ? "text-accent-blue" : "text-text-secondary group-hover:text-accent-blue"
                                )} 
                                strokeWidth={1.5}
                            />
                            <span className={cn(
                                "text-sm font-medium",
                                preferences.includes(interest.id) ? "text-accent-blue" : "text-text-primary"
                            )}>
                                {interest.label}
                            </span>
                        </div>
                    ))}
                </div>
                {errors.preferences && <p className="text-sm text-red-500">{errors.preferences.message}</p>}
           </div>
        </div>
      )
    }
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Plan a New Trip" maxWidth="lg">
        <form onSubmit={handleSubmit(onSubmit)}>
            <Wizard 
                steps={steps.map(s => ({ ...s, component: s.component }))} 
                currentStep={step}
            />
            
            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                {step > 0 && (
                    <Button type="button" variant="secondary" onClick={() => setStep(s => s - 1)}>Back</Button>
                )}
                {step < steps.length - 1 ? (
                    <Button type="button" onClick={handleNext}>Next</Button>
                ) : (
                    <Button type="submit" isLoading={createTripMutation.isPending}>Create Project</Button>
                )}
            </div>
            {createTripMutation.isError && (
                 <p className="text-sm text-red-500 mt-2 text-right">
                    {(createTripMutation.error as unknown as { response?: { data?: { detail?: string } } })?.response?.data?.detail || createTripMutation.error.message || "Failed to create trip."}
                 </p>
            )}
        </form>
    </Modal>
  );
}

