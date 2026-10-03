export const EVENT_IMAGE_LIMIT = 6;
export const EVENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const EVENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const eventImageId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const eventImageUrl = (proposalId, imageId) => eventImageId(proposalId) && eventImageId(imageId) ? `/api/event-images/${proposalId}/${imageId}` : '';
