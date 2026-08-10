/**
 * The MyTableView brand mark — monogram plus optional wordmark.
 *
 * One component, every surface: the monogram strokes follow
 * currentColor so each theme (dark floor, light editor, warm guest)
 * colours it from its own text colour; only the Y-tick keeps the brand
 * orange everywhere.
 */

type Props = {
  withWordmark?: boolean;
  className?: string;
};

export function BrandMark({ withWordmark = true, className }: Props) {
  return (
    <span className={className ? `mtv-brand ${className}` : "mtv-brand"}>
      <svg className="mtv-brand-mark" viewBox="0 0 44 44" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="40"
          height="40"
          rx="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          d="M12 31 V14 l10 11 10-11 v17"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 31 l4 5 4-5"
          fill="none"
          stroke="#d5872e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark ? (
        <span className="mtv-brand-word">
          mytable<em>view</em>
        </span>
      ) : null}
    </span>
  );
}
