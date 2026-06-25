import { logoFor } from './logos'

export function Logo({
  branch = 'Group',
  height = 34,
  className,
}: {
  branch?: string
  height?: number
  className?: string
}) {
  return (
    <img
      src={logoFor(branch)}
      alt={`Renew-it ${branch}`}
      height={height}
      style={{ height, width: 'auto', display: 'block' }}
      className={className}
    />
  )
}
