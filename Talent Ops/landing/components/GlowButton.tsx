import React, { forwardRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ComponentProps {
    label?: string;
    onClick?(): void;
    className?: string;
    href?: string;
}

export const GlowButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, ComponentProps>(
    ({ label = "Generate", onClick, className, href }, ref) => {
        const [isClicked, setIsClicked] = useState(false);

        const navigate = useNavigate();

        const handleClick = (e: React.MouseEvent) => {
            if (href && href.startsWith('/')) {
                e.preventDefault();
                navigate(href);
            }
            setIsClicked(true);
            setTimeout(() => setIsClicked(false), 200);
            onClick?.();
        };

        const content = (
            <span className="flex items-center justify-center gap-1.5 pointer-events-none">
                {label}
                <Sparkles size={16} className="ml-0.5" />
            </span>
        );

        if (href) {
            return (
                <a
                    href={href}
                    className={cn("glow-btn inline-block", className)}
                    onClick={handleClick}
                    data-state={isClicked ? "clicked" : undefined}
                    ref={ref as React.Ref<HTMLAnchorElement>}
                >
                    {content}
                </a>
            );
        }

        return (
            <button
                ref={ref as React.Ref<HTMLButtonElement>}
                type="button"
                aria-label={label}
                className={cn("glow-btn", className)}
                onClick={handleClick}
                data-state={isClicked ? "clicked" : undefined}
            >
                {content}
            </button>
        );
    }
);

GlowButton.displayName = "GlowButton";
