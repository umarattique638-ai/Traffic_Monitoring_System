import { LuCheck } from 'react-icons/lu'
import logo from '../../assets/lg.png'

const points = [
  'Bots and spam filtered, every drop itemised',
  'Shows its own margin of error, not just a number',
  'No IP address stored',
]

const bars = [30, 38, 45, 52, 60, 68, 76, 84, 92, 100]

function AuthHero() {
  return (
    <aside
      className='hidden lg:block sticky top-0 h-screen w-[51%] shrink-0 bg-teal-400'
      style={{ clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0 100%)' }}
    >
      <div
        className='min-h-screen flex flex-col justify-between px-16 py-14 text-white'
        style={{
          clipPath: 'polygon(0 0, calc(100% - 3px) 0, calc(90% - 3px) 100%, 0 100%)',
          backgroundColor: '#020618',
          backgroundImage: `
            radial-gradient(ellipse at top left, rgba(20,184,166,0.28), transparent 55%),
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 44px 44px, 44px 44px',
        }}
      >
        {/* Logo */}
        <img src={logo} alt='Tailwatch' width={160} className='object-contain' />

        {/* Heading + points */}

        <div className='max-w-md xl:max-w-lg'>
          <h1 className='text-3xl xl:text-4xl 2xl:text-5xl font-bold leading-[1.1] tracking-tight'>
            The truth about how many humans visited.
          </h1>

          <p className='mt-3 xl:mt-5 text-sm xl:text-base text-gray-400 leading-relaxed'>
            Privacy-first web analytics: real visitors, real numbers, and an honest margin of error.
          </p>

          <ul className='mt-5 xl:mt-8 flex flex-col gap-2.5 xl:gap-4'>
            {points.map((point) => (
              <li key={point} className='flex items-center gap-3 text-xs xl:text-sm text-gray-200'>
                <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-teal-400'>
                  <LuCheck className='text-xs' />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Capture rate card */}
        <div className='mr-28 lg:mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5'>
          <div className='flex items-end justify-between'>
            <div>
              <p className='text-sm text-gray-400'>Capture rate</p>
              <p className='mt-1 text-3xl font-bold'>91.4%</p>
            </div>

            <div className='flex h-12 items-end gap-1.5' aria-hidden='true'>
              {bars.map((h, index) => (
                <span
                  key={index}
                  className='w-2 rounded-full'
                  style={{
                    height: `${h}%`,
                    background: 'linear-gradient(to top, #0d9488, #5eead4)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className='my-4 h-px bg-white/10' />

          <p className='text-xs text-gray-400'>
            An example: 1,284 of 1,405 expected beacons received. The dashboard shows what it could not see,
            too.
          </p>
        </div>
      </div>
    </aside>
  )
}

export default AuthHero
