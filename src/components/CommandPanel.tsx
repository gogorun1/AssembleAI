import { Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import styles from './CommandPanel.module.css';

export type CommandLanguage = 'en' | 'fr';

interface CommandPanelProps {
  language: CommandLanguage;
  onLanguageChange(language: CommandLanguage): void;
  onSubmit(text: string): void | Promise<void>;
  disabled?: boolean;
}

const placeholders: Record<CommandLanguage, string> = {
  en: "Type a command, e.g. What's next?",
  fr: 'Tape une commande, ex. Et cette vis, elle va où ?'
};

export function CommandPanel({
  language,
  onLanguageChange,
  onSubmit,
  disabled = false
}: CommandPanelProps) {
  const [value, setValue] = useState('');
  const command = value.trim();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!command || disabled) {
      return;
    }
    void onSubmit(command);
    setValue('');
  };

  return (
    <section className={styles.panel} aria-label="Typed command">
      <div className={styles.header}>
        <div className={styles.heading}>Typed Command</div>
        <div className={styles.segmented} role="group" aria-label="Assistant language">
          <button
            type="button"
            className={styles.segment}
            data-testid="language-en"
            aria-pressed={language === 'en'}
            disabled={disabled}
            onClick={() => onLanguageChange('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={styles.segment}
            data-testid="language-fr"
            aria-pressed={language === 'fr'}
            disabled={disabled}
            onClick={() => onLanguageChange('fr')}
          >
            FR
          </button>
        </div>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <input
          className={styles.input}
          data-testid="command-input"
          aria-label="Type an assembly command"
          disabled={disabled}
          placeholder={placeholders[language]}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        <button
          type="submit"
          className={styles.submit}
          data-testid="command-submit"
          disabled={disabled || command.length === 0}
          aria-label="Send typed command"
          title="Send typed command"
        >
          <Send size={15} aria-hidden />
        </button>
      </form>
    </section>
  );
}
