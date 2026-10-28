export const APP = 'Traffic Monitoring';

export function shout(text: string): string {
  return text.toUpperCase() + '!';
}

export type Shouted = string;

export default function hello(): string {
  return 'hello';
}
