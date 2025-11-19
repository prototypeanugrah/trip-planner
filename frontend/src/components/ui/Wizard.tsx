import * as React from "react";
import { cn } from "@/lib/utils";

interface WizardStep {
  id: string;
  title: string;
  description?: string;
  component: React.ReactNode;
}

interface WizardProps {
  steps: WizardStep[];
  onComplete: (data: any) => void;
  defaultStep?: number;
  currentStep?: number;
}

export function Wizard({ steps, onComplete, defaultStep = 0, currentStep: controlledStep }: WizardProps) {
  const [internalStep, setInternalStep] = React.useState(defaultStep);
  
  const currentStep = controlledStep !== undefined ? controlledStep : internalStep;
  const [history, setHistory] = React.useState<number[]>([currentStep]);

  // This is a simplified wizard that relies on children to control navigation
  // or we can expose context. For now, let's just render the current step.
  // In a real app, we'd use a context or render props pattern.

  // But to make it usable with the current plan, I will just export a Stepper UI
  // and let the parent manage the state, which is often more flexible.

  return (
    <div className="w-full">
       <div className="mb-8">
        <div className="flex items-center justify-between px-2">
            {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center gap-2 z-10">
                             <div
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300",
                                    isActive ? "bg-accent-blue text-white shadow-[0_0_0_4px_rgba(0,122,255,0.2)]" :
                                    isCompleted ? "bg-accent-blue text-white" : "bg-bg-elevated text-text-tertiary"
                                )}
                            >
                                {isCompleted ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </div>
                            <span className={cn("text-xs font-medium transition-colors duration-300 absolute mt-10 w-32 text-center", 
                                isActive ? "text-text-primary" : "text-text-tertiary"
                            )}>
                                {step.title}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="flex-1 h-[2px] mx-2 bg-bg-elevated relative -top-3">
                                <div 
                                    className="absolute inset-0 bg-accent-blue transition-all duration-500"
                                    style={{ width: isCompleted ? '100%' : '0%' }}
                                />
                            </div>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
       </div>

       <div className="mt-8 pt-4">
            {steps[currentStep].component}
       </div>
    </div>
  );
}

