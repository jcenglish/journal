import { RATINGS, type Rating } from '../lib/entries'
import styles from './RatingSelector.module.css'

interface RatingSelectorProps {
  legend: string
  name: string
  value: number | null
  onChange: (rating: Rating) => void
}

export function RatingSelector({ legend, name, value, onChange }: RatingSelectorProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {RATINGS.map((rating) => (
          <label key={rating} className={styles.option}>
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
            />
            <span className={styles.circle}>{rating}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
