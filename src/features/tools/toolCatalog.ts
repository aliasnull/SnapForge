/** Single source of truth for the tool list, shared by the landing and tools pages. */

import type { IconName } from '../../components/Icon';

export interface ToolDefinition {
  path: string;
  icon: IconName;
  name: string;
  description: string;
  badge?: string;
}

export const TOOLS: ToolDefinition[] = [
  {
    path: '/compress',
    icon: 'compress',
    name: 'Compress',
    description: 'Reduce image file size while maintaining visual quality.',
  },
  {
    path: '/resize',
    icon: 'resize',
    name: 'Resize',
    description: 'Change image dimensions while preserving aspect ratio.',
  },
  {
    path: '/convert',
    icon: 'convert',
    name: 'Convert',
    description: 'Convert between JPEG, PNG, WebP and AVIF.',
  },
  {
    path: '/crop',
    icon: 'crop',
    name: 'Crop',
    description: 'Crop an image using freeform or preset aspect ratios.',
  },
  {
    path: '/rotate',
    icon: 'rotate',
    name: 'Rotate & Flip',
    description: 'Rotate or flip images in a single tap.',
  },
  {
    path: '/batch',
    icon: 'batch',
    name: 'Batch',
    description: 'Process multiple images using the same operation.',
    badge: 'Up to 40',
  },
];
