import { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TripService, type Participant } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { LocationInput } from '@/components/ui/LocationInput';
import { Button } from '@/components/ui/Button';
import { RadioCard, RadioCardGroup } from '@/components/ui/RadioGroup';
import { cn, toTitleCase } from '@/lib/utils';
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

const participantSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
  location: z.string().optional(),
  budget: z.enum(['low', 'medium', 'high']),
  preferences: z.array(z.string()).min(1, "Select at least one preference"),
});

type ParticipantForm = z.infer<typeof participantSchema>;

interface AddParticipantWizardProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  initialData?: Participant | null;
}

export function AddParticipantWizard({ isOpen, onClose, tripId, initialData }: AddParticipantWizardProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, control, formState: { errors }, reset, watch } = useForm<ParticipantForm>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
        preferences: [],
        budget: 'medium'
    }
  });

  const preferences = useWatch({ control, name: 'preferences' });
  const phone = useWatch({ control, name: 'phone' });

  useEffect(() => {
    if (isOpen && initialData) {
        reset({
            name: initialData.name,
            phone: initialData.phone || '',
            location: initialData.survey_response?.location || '',
            budget: (initialData.survey_response?.budget as 'low' | 'medium' | 'high') || 'medium',
            preferences: initialData.survey_response?.preferences || []
        });
    } else if (isOpen && !initialData) {
        reset({
            name: '',
            phone: '',
            location: '',
            budget: 'medium',
            preferences: []
        });
    }
  }, [isOpen, initialData, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ParticipantForm) => {
      if (initialData) {
         const updated = await TripService.updateParticipant(tripId, initialData.id, {
            name: toTitleCase(data.name),
            phone: data.phone,
         });
         await TripService.saveSurveyResponse(tripId, initialData.id, {
            location: data.location,
            budget: data.budget,
            preferences: data.preferences
         });
         return updated;
      } else {
        const participant = await TripService.addParticipant(tripId, {
            name: toTitleCase(data.name),
            phone: data.phone,
            role: 'traveler'
        });

        await TripService.saveSurveyResponse(tripId, participant.id, {
            location: data.location,
            budget: data.budget,
            preferences: data.preferences
        });
        return participant;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants', tripId] });
      onClose();
    }
  });

  const onSubmit = (data: ParticipantForm) => {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Edit Participant" : "Add New Participant"} maxWidth="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
            <Input 
                label="Name" 
                placeholder="Participant Name" 
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
                                preferences.includes(p.id)
                                    ? "bg-accent-blue/10 border-accent-blue text-accent-blue"
                                    : "bg-input-bg border-border hover:bg-bg-tertiary hover:border-accent-blue/30"
                            )}
                        >
                            <p.icon 
                                className={cn(
                                    "w-6 h-6 transition-colors", 
                                    preferences.includes(p.id) ? "text-accent-blue" : "text-text-secondary group-hover:text-accent-blue"
                                )} 
                                strokeWidth={1.5}
                            />
                            <span className={cn(
                                "text-sm font-medium",
                                preferences.includes(p.id) ? "text-accent-blue" : "text-text-primary"
                            )}>
                                {p.label}
                            </span>
                        </div>
                    ))}
                </div>
                {errors.preferences && <p className="text-sm text-red-500">{errors.preferences.message}</p>}
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={mutation.isPending}>
                {initialData ? "Save Changes" : "Add Participant"}
            </Button>
        </div>
      </form>
    </Modal>
  );
}

