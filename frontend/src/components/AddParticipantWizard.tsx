import { useEffect, useState } from 'react';
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
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const inviteSchema = z.object({
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits").optional().or(z.literal('')),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone is required",
  path: ["email"]
});

const editSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits").optional().or(z.literal('')),
  location: z.string().optional(),
  budget: z.enum(['low', 'medium', 'high']),
  preferences: z.array(z.string()).min(1, "Select at least one preference"),
});

type InviteForm = z.infer<typeof inviteSchema>;
type EditForm = z.infer<typeof editSchema>;
type ParticipantForm = InviteForm & EditForm;

interface AddParticipantWizardProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  initialData?: Participant | null;
}

export function AddParticipantWizard({ isOpen, onClose, tripId, initialData }: AddParticipantWizardProps) {
  const queryClient = useQueryClient();
  const isEditMode = !!initialData;
  const [showSuccess, setShowSuccess] = useState(false);

  const { register, handleSubmit, setValue, control, formState: { errors }, reset, watch } = useForm<ParticipantForm>({
    resolver: zodResolver(isEditMode ? editSchema : inviteSchema),
    defaultValues: {
        preferences: [],
        budget: 'medium',
        email: '',
        phone: '',
        name: '',
        location: ''
    }
  });

  const preferences = useWatch({ control, name: 'preferences' });
  const phone = useWatch({ control, name: 'phone' });

  useEffect(() => {
    if (isOpen) {
        setShowSuccess(false);
        if (initialData) {
            reset({
                name: initialData.name,
                phone: initialData.phone || '',
                email: initialData.email || '',
                location: initialData.survey_response?.location || '',
                budget: (initialData.survey_response?.budget as 'low' | 'medium' | 'high') || 'medium',
                preferences: initialData.survey_response?.preferences || []
            });
        } else {
            reset({
                name: '',
                phone: '',
                email: '',
                location: '',
                budget: 'medium',
                preferences: []
            });
        }
    }
  }, [isOpen, initialData, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ParticipantForm) => {
      if (isEditMode && initialData) {
         const updated = await TripService.updateParticipant(tripId, initialData.id, {
            name: toTitleCase(data.name),
            phone: data.phone || undefined,
            email: data.email || undefined,
         });
         await TripService.saveSurveyResponse(tripId, initialData.id, {
            location: data.location,
            budget: data.budget,
            preferences: data.preferences
         });
         return updated;
      } else {
        // Invite Mode
        return await TripService.inviteParticipant(tripId, {
            email: data.email || undefined,
            phone: data.phone || undefined
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants', tripId] });
      if (!isEditMode) {
          setShowSuccess(true);
          setTimeout(() => {
              onClose();
          }, 2000);
      } else {
          onClose();
      }
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Participant" : "Invite Participant"} maxWidth="lg">
      <AnimatePresence mode="wait">
        {showSuccess ? (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-12 space-y-4"
            >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary">Invitation Sent!</h3>
                <p className="text-text-secondary text-center">
                    The participant has been invited to join the trip.
                </p>
            </motion.div>
        ) : (
            <motion.form 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit(onSubmit)} 
                className="space-y-6"
            >
                <div className="space-y-4">
                    {!isEditMode && (
                        <>
                            <p className="text-sm text-text-secondary">Enter the email or phone number of the person you want to invite.</p>
                            <Input 
                                label="Email" 
                                placeholder="user@example.com" 
                                type="email"
                                {...register('email')} 
                                error={errors.email?.message}
                            />
                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-border"></div>
                                <span className="flex-shrink-0 mx-4 text-text-secondary text-sm">OR</span>
                                <div className="flex-grow border-t border-border"></div>
                            </div>
                        </>
                    )}

                    {(isEditMode || !isEditMode) && (
                        <Input 
                            label="Phone" 
                            placeholder="10 digit number" 
                            type="tel"
                            {...register('phone')} 
                            error={phone && phone.length > 10 ? `You have entered ${phone.length} digits. Please enter a 10 digit number` : errors.phone?.message}
                        />
                    )}

                    {isEditMode && (
                        <>
                            <Input 
                                label="Name" 
                                placeholder="Participant Name" 
                                {...register('name')} 
                                error={errors.name?.message}
                                className="capitalize"
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
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={mutation.isPending}>
                        {isEditMode ? "Save Changes" : "Send Invite"}
                    </Button>
                </div>
            </motion.form>
        )}
      </AnimatePresence>
    </Modal>
  );
}
