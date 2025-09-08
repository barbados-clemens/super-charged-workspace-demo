import { Button } from 'react-native';
export function FancyButton({ text }: { text: string }) {
  return <Button title={'fancy ' + text} />;
}
