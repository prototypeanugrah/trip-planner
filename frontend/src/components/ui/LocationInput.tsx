import * as React from "react";
import { cn } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";
import axios from "axios";

export interface LocationInputProps {
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  name?: string;
}

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const LocationInput = React.forwardRef<HTMLInputElement, LocationInputProps>(
  ({ className, value = "", onChange, error, label, placeholder, onBlur, name }, ref) => {
    const [query, setQuery] = React.useState(value);
    const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [showSuggestions, setShowSuggestions] = React.useState(false);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    
    // To prevent fetching when setting initial value or selecting from list
    const shouldFetchRef = React.useRef(false);

    // Sync internal state with external value
    React.useEffect(() => {
      setQuery(value);
    }, [value]);

    // Click outside to close suggestions
    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setShowSuggestions(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    const fetchSuggestions = React.useCallback(async (input: string) => {
      if (!input || input.length < 3) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}`,
          {
            headers: {
              "Accept-Language": "en-US", 
            }
          }
        );
        setSuggestions(response.data || []);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching location suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, []);

    // Debounce the search
    React.useEffect(() => {
      const timer = setTimeout(() => {
        if (shouldFetchRef.current) {
            fetchSuggestions(query);
            shouldFetchRef.current = false; // Reset after triggering fetch
        }
      }, 500);

      return () => clearTimeout(timer);
    }, [query, fetchSuggestions]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setQuery(newValue);
      onChange(newValue);
      shouldFetchRef.current = true; // Enable fetch for user input
    };

    const handleSelectSuggestion = (suggestion: Suggestion) => {
      const newValue = suggestion.display_name;
      shouldFetchRef.current = false; // Disable fetch for selection
      setQuery(newValue);
      onChange(newValue);
      setSuggestions([]);
      setShowSuggestions(false);
    };

    return (
      <div className="w-full space-y-2" ref={wrapperRef}>
        {label && (
          <label className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type="text"
            value={query}
            onChange={handleInputChange}
            onBlur={onBlur}
            name={name}
            placeholder={placeholder}
            className={cn(
              "flex h-11 w-full rounded-xl border border-input-border bg-input-bg pl-11 pr-4 py-3 text-[17px] text-text-primary ring-offset-bg-primary file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-[#8e8e93]/20",
              error && "border-red-500 focus-visible:ring-red-500",
              className
            )}
            autoComplete="off"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <MapPin className="h-5 w-5" />
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-input-border bg-bg-secondary py-1 shadow-lg">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-accent-blue/10 hover:text-accent-blue transition-colors"
                >
                  {suggestion.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      </div>
    );
  }
);

LocationInput.displayName = "LocationInput";
