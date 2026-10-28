import { Activity, Download, Eye, Globe, MapPin, Monitor, Smartphone, Tablet, Timer, Users, Zap } from 'lucide-react'
import FilterBar from '../../components/dashboard/FilterBar'
import FilterMenu from '../../components/dashboard/FilterMenu'
import FinishSetup from '../../components/dashboard/FinishSetup'
import GettingStarted from '../../components/dashboard/GettingStarted'
import HealthBanner from '../../components/dashboard/HealthBanner'
import KpiCard from '../../components/dashboard/KpiCard'
import LiveEvents from '../../components/dashboard/LiveEvents'
import RangeSelect from '../../components/dashboard/RangeSelect'
import VerticalBars from '../../components/dashboard/VerticalBars'
import WarningsFeed from '../../components/dashboard/WarningsFeed'
import { BarList, LiveChart, SourcesDonut, VisitorsChart } from '../../components/dashboard/charts'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Notice from '../../components/ui/Notice'
import PageHeader from '../../components/ui/PageHeader'
import Panel from '../../components/ui/Panel'
import { useAuth } from '../../hooks/auth/useAuth'
import { useDocumentTitle } from '../../hooks/common/useDocumentTitle'
import { useSetup } from '../../hooks/setup/useSetup'
import { useCurrentSite } from '../../hooks/sites/useCurrentSite'
import { firstName, todayLabel, useDashboard } from '../../hooks/stats/useDashboard'
import { greeting } from '../../hooks/stats/useOverview'
import type { Site } from '../../types/tailwatch'
import { capital, countryName, duration, num, percent, share } from '../../utils/format'

const deviceIcon = (label: string) => (/mobile/i.test(label) ? Smartphone : /tablet/i.test(label) ? Tablet : Monitor)

/** Every number here comes from the stats API (ClickHouse). Nothing is sample data. */
function Dashboard() {
  useDocumentTitle('Overview')
  const { user } = useAuth()
  const current = useCurrentSite()
  const { setup } = useSetup()

  if (!current) return setup ? <FinishSetup setup={setup} /> : <GettingStarted />
  return <Overview site={current} name={user ? firstName(user) : ''} />
}

function Overview({ site, name }: { site: Site; name: string }) {
  const d = useDashboard(site)
  const { o, k, l, changes } = d

  return (
    <div className='grid gap-6'>
      <PageHeader
        title={`${greeting()}, ${name}.`}
        description={
          <>
            {todayLabel()} · <span className='font-medium text-slate-700'>{site.domain}</span> · {d.tz}
          </>
        }
        actions={
          <>
            <FilterMenu siteId={site.id} range={d.range} filters={d.filter.filters} onPick={d.filter.set} />
            <RangeSelect value={d.range} onChange={d.setRange} />
            <Button
              variant='secondary'
              size='sm'
              className='h-10'
              onClick={() => d.csv.exportCsv()}
              loading={d.csv.busy}
            >
              {!d.csv.busy && <Download className='size-4' aria-hidden='true' />} Export CSV
            </Button>
          </>
        }
      />

      <HealthBanner site={site} />
      <FilterBar
        filters={d.filter.filters}
        active={d.filter.active}
        onRemove={d.filter.remove}
        onClear={d.filter.clear}
      />
      {d.overview.error && <Notice tone='error'>{d.overview.error}</Notice>}

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
        <KpiCard
          icon={Users}
          label='Active now'
          value={l ? num(l.active) : null}
          note='Visitors this minute, as on the live chart'
        />
        <KpiCard
          icon={Activity}
          label='Sessions'
          value={k ? num(k.sessions) : null}
          delta={changes.sessions?.delta}
          up={changes.sessions?.up}
          positive={changes.sessions?.up}
        />
        <KpiCard
          icon={Eye}
          label='Page views'
          value={k ? num(k.pageviews) : null}
          delta={changes.pageviews?.delta}
          up={changes.pageviews?.up}
          positive={changes.pageviews?.up}
        />
        <KpiCard
          icon={Zap}
          label='Bounce rate'
          value={k ? percent(k.bounceRate) : null}
          delta={changes.bounce === null ? undefined : `${Math.abs(changes.bounce).toFixed(1)} pts`}
          up={(changes.bounce ?? 0) >= 0}
          positive={(changes.bounce ?? 0) <= 0}
          note={
            k && !d.enoughNow && k.sessions > 0
              ? `From only ${num(k.sessions)} visit${k.sessions === 1 ? '' : 's'}`
              : undefined
          }
        />
        <KpiCard
          icon={Timer}
          label='Time on site'
          value={k ? duration(d.visitTime) : null}
          delta={changes.visitTime?.delta}
          up={changes.visitTime?.up}
          positive={changes.visitTime?.up}
        />
      </div>

      <div className='grid gap-4 xl:grid-cols-3'>
        <Panel
          title='Visitors over time'
          subtitle={`${o?.range.hourly ? 'Per hour' : 'Per day'} in ${d.tz}${k?.visitorsEstimated ? ' · visitors estimated (daily hashes)' : ''}`}
          className='xl:col-span-2'
        >
          <VisitorsChart
            data={(o?.series ?? []).map((r) => ({ date: r.label, visitors: r.visitors, sessions: r.sessions }))}
          />
        </Panel>
        <Panel title='Traffic sources' subtitle='Sessions by channel'>
          <SourcesDonut
            sources={d.sources}
            total={k?.visitors ?? 0}
            caption={k?.visitorsEstimated ? 'Visitors (est.)' : 'Unique visitors'}
          />
        </Panel>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Panel
          title='Live visitors'
          subtitle='Visitors per minute, last 30 minutes'
          action={
            <span className='flex items-center gap-1.5 text-xs font-medium text-emerald-600'>
              <span className='size-2 animate-pulse rounded-full bg-emerald-500' aria-hidden='true' />
              Live
            </span>
          }
        >
          <LiveChart
            data={(l?.minutes ?? []).map((m) => ({
              time: new Date(m.minute).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              count: m.visitors,
            }))}
          />
        </Panel>
        <Panel title='Latest hits' subtitle='Page views and events, newest 20 from the last 24 hours'>
          <LiveEvents events={l?.events ?? null} />
        </Panel>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Panel title='Top pages' subtitle='Page views in this period'>
          <BarList rows={share(o?.pages ?? [])} />
        </Panel>
        <Panel title='Top referrers' subtitle='Sessions by referring site'>
          <BarList rows={share(o?.referrers ?? [])} icon={Globe} empty='No referrers yet: all direct traffic.' />
        </Panel>
        <Panel title='Top locations' subtitle='Visitors by country'>
          <BarList
            rows={share((o?.countries ?? []).map((r) => ({ ...r, label: countryName(r.label) })))}
            icon={MapPin}
          />
        </Panel>
        <WarningsFeed items={o?.drops ?? []} />
        <Panel title='Devices' subtitle='Visitors by device'>
          {o && o.devices.length === 0 ? (
            <EmptyState compact title='No data yet' />
          ) : (
            <VerticalBars
              rows={share((o?.devices ?? []).map((r) => ({ ...r, label: capital(r.label) })))}
              iconFor={deviceIcon}
            />
          )}
        </Panel>
        <Panel title='Browsers' subtitle='Visitors by browser'>
          {o && o.browsers.length === 0 ? (
            <EmptyState compact title='No data yet' />
          ) : (
            <VerticalBars
              rows={share((o?.browsers ?? []).map((r) => ({ ...r, label: r.label || 'Other' })))}
              iconFor={() => Globe}
            />
          )}
        </Panel>
      </div>
    </div>
  )
}

export default Dashboard
