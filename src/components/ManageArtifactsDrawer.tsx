import React, { useState, useRef } from 'react';
import { Image, UploadCloud, X, AlertCircle } from 'lucide-react';
import { EventRecord } from '../types';
import { useRealTimeQnA } from '../useRealTimeQnA';

interface ManageArtifactsDrawerProps {
  events: EventRecord[];
  onUploadEventMedia: ReturnType<typeof useRealTimeQnA>['uploadEventMedia'];
  onDeleteEventMedia: ReturnType<typeof useRealTimeQnA>['deleteEventMedia'];
}

export function ManageArtifactsDrawer({ events, onUploadEventMedia, onDeleteEventMedia }: ManageArtifactsDrawerProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'logo' | 'banner', slot?: 1 | 2 | 3) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      await onUploadEventMedia(selectedEventId, kind, file, slot);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Manage Artifacts</h3>
      <select
        value={selectedEventId}
        onChange={(e) => setSelectedEventId(e.target.value)}
        className="input-base w-full mb-4"
      >
        <option value="" disabled>Select an event</option>
        {events.map(event => (
          <option key={event.id} value={event.id}>{event.title}</option>
        ))}
      </select>

      {selectedEvent && (
        <div>
          {error && (
            <div className="bg-rose-500/10 text-rose-500 p-3 rounded-md flex items-center gap-2 mb-4">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-6">
            <h4 className="font-semibold mb-2">Logo</h4>
            <div className="flex items-center gap-4">
              {selectedEvent.logoUrl ? (
                <img src={selectedEvent.logoUrl} alt="Event Logo" className="w-24 h-24 object-contain border rounded-md" />
              ) : (
                <div className="w-24 h-24 bg-surface-2 rounded-md flex items-center justify-center">
                  <Image size={32} className="text-muted" />
                </div>
              )}
              <div className="flex-grow">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  ref={fileInputRef}
                  onChange={(e) => handleFileChange(e, 'logo')}
                  className="hidden"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={16} />
                  Upload Logo
                </button>
                {selectedEvent.logoUrl && (
                  <button
                    className="btn btn-danger ml-2"
                    onClick={() => onDeleteEventMedia(selectedEventId, 'logo')}
                  >
                    <X size={16} />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Banners</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(slot => (
                <div key={slot} className="border rounded-md p-3">
                  <h5 className="text-sm font-medium mb-2">Banner {slot}</h5>
                  {selectedEvent.bannerUrls?.[slot - 1] ? (
                    <img src={selectedEvent.bannerUrls[slot - 1]!} alt={`Banner ${slot}`} className="w-full h-32 object-cover rounded-md mb-2" />
                  ) : (
                    <div className="w-full h-32 bg-surface-2 rounded-md flex items-center justify-center mb-2">
                      <Image size={32} className="text-muted" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    id={`banner-input-${slot}`}
                    onChange={(e) => handleFileChange(e, 'banner', slot as 1 | 2 | 3)}
                    className="hidden"
                  />
                  <label htmlFor={`banner-input-${slot}`} className="btn btn-secondary w-full">
                    <UploadCloud size={16} />
                    Upload Banner
                  </label>
                  {selectedEvent.bannerUrls?.[slot - 1] && (
                    <button
                      className="btn btn-danger w-full mt-2"
                      onClick={() => onDeleteEventMedia(selectedEventId, 'banner', slot as 1 | 2 | 3)}
                    >
                      <X size={16} />
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
