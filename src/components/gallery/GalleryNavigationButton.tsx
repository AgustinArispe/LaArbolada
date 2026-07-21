import { ArrowLeft, ArrowRight } from 'lucide-react';

type Props = {
  direction: 'previous' | 'next';
  disabled: boolean;
  onClick: () => void;
};

export function GalleryNavigationButton({ direction, disabled, onClick }: Props) {
  const Icon = direction === 'previous' ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      className="gallery-navigation-button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'previous' ? 'Fotografía anterior' : 'Fotografía siguiente'}
    >
      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
