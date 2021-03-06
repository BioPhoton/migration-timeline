import {Observable, of, pipe} from 'rxjs';
import {map, startWith} from 'rxjs/operators';

import {LocalState} from '../utils/local-state.service';
import {ClientMigrationTimelineReleaseItem, compareByReleaseDateAsc, parseClientMigrationTimelineReleaseItem} from './migration-item';
import {deprecationAndBreakingChangeTimeline} from './migration-timeline-struckture/migration-timeline.data';

export interface MigrationTimelineState {
  migrations: ClientMigrationTimelineReleaseItem[]
}

export class MigrationTimelineService extends LocalState<MigrationTimelineState> {

  private initialMigrations: ClientMigrationTimelineReleaseItem[] = [];
  private staticMigrations: ClientMigrationTimelineReleaseItem[] =
    deprecationAndBreakingChangeTimeline.map(release => parseClientMigrationTimelineReleaseItem(release));
  migrations$: Observable<ClientMigrationTimelineReleaseItem[]> = this.select(pipe(
    map(s => s.migrations), startWith(this.initialMigrations))
  );

  constructor() {
    super();
    this.fetchMigrationTimeline();
  }

  fetchMigrationTimeline(): void {
    this.connectState(of({
        // ensure base sorting by date before putting it into client state
        migrations: this.staticMigrations.sort(compareByReleaseDateAsc)
      })
    );
  }

}
