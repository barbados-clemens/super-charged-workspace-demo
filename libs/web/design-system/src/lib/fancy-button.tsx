import styles from './design-system.module.css';

export function FancyButton({ text }: { text: string }) {
  return (
    <div className={styles['container']}>
      <button>{text}</button>
    </div>
  );
}

export default FancyButton;
