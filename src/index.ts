import {MigrationTimelineService} from "./data-access/migration-timeline.service";

import {filter} from "rxjs/operators";
import {
    ClientBreakingChange,
    ClientDeprecation,
    ClientMigrationTimelineReleaseItem
} from "./data-access/migration-item";
import {BreakingChange, Deprecation} from "./data-access/migration-timeline-struckture/migration-item";

const migrationService = new MigrationTimelineService();

export interface ExistingRelease {
    [id: string]: ClientMigrationTimelineReleaseItem
}

export interface ExistingBreakingChange {
    [id: string]: ClientBreakingChange
}

export interface ExistingDeprecations {
    [id: string]: ClientDeprecation
}

export interface MissingBreakingChange {
    [id: string]: { b: BreakingChange, d: Deprecation }
}

function mapToExistingRelease(rawList: ClientMigrationTimelineReleaseItem[]): ExistingRelease {
    return rawList
        .reduce((acc, release) => {
            if (acc[release.version]) {
                console.log('Release DUPLICATE');
            }
            return {...acc, [release.version]: release.version};
        }, {});
}

function mapToExistingDeprecations(rawList: ClientMigrationTimelineReleaseItem[]): ExistingDeprecations {
    return rawList
        .map((release) => {
            return release.deprecations.reduce((acc, d) => {
                if (acc[d.migrationItemUID]) {
                    console.log('Deprecation DUPLICATE');
                }
                return {...acc, [d.migrationItemUID]: d};
            }, {});
        })
        .reduce((acc, o) => ({...acc, ...o}), {});
}

function mapToExistingBreakingChanges(rawList: ClientMigrationTimelineReleaseItem[]): ExistingBreakingChange {
    return rawList
        .map((release) => {
            return release.breakingChanges.reduce((acc, i) => {
                if (acc[i.migrationItemUID]) {
                    console.log('BreakingChange DUPLICATE');
                }
                return {...acc, [i.migrationItemUID]: i};
            }, {});
        })
        .reduce((acc, o) => ({...acc, ...o}), {});
}

function mapToMissingBreakingChanges(rawList: ClientMigrationTimelineReleaseItem[], existingBreakingChange: ExistingBreakingChange): MissingBreakingChange {
    return rawList
        .map((release) => {
                return release.deprecations
                    .filter((d) => !existingBreakingChange[d.opponentMigrationItemUID])
                    .reduce((acc, d) => {
                        const b = getBreakingChangeFromDeprecation(d, {
                            version: release.version,
                            breakingChangeMsg: '@TODO'
                        });
                        return {...acc, [d.opponentMigrationItemUID]: {b, d}};
                    }, {});
            }
        ).reduce((acc, o) => ({...acc, ...o}), {});

}

function mapToWrongDeprecationLink(existingDeprecations: ExistingDeprecations, existingBreakingChange: ExistingBreakingChange): ExistingBreakingChange {
    return Object.entries(existingBreakingChange)
        .filter(([mUID, b]) => {
            if (!existingDeprecations[b.opponentMigrationItemUID]) {
                console.log('dep.MUID', b.opponentMigrationItemUID, b.migrationItemUID);
                return true;
            }
            return false;
        })
        .reduce((acc, [mUID, b]) => ({...acc, [mUID]: b}), {})
}

function logChecklist(rawList: ClientMigrationTimelineReleaseItem[]): void {
    const existingRelease = mapToExistingRelease(rawList);
    const existingDeprecations = mapToExistingDeprecations(rawList);
    const existingBreakingChanges = mapToExistingBreakingChanges(rawList);
    let num = 0;
    const cfg = {
        onlyWrong: true
    };
    const releases = {};
    rawList
        .forEach((release) => {
            release.deprecations.forEach((d) => {
                const msg = [];

                if (!existingBreakingChanges[d.opponentMigrationItemUID]) {
                    msg.push(`    - [ ] [missing] ${d.opponentMigrationItemUID}  `);
                }
                if (d.exampleBefore) {
                    if (d.exampleBefore.indexOf('source') === -1) {
                        msg.push(`    - [ ] [exampleBefore] use source as variable name  `);
                    }
                    if (d.exampleAfter.indexOf('source') === -1) {
                        msg.push(`    - [ ] [exampleAfter] use source as variable name  `);
                    }
                }

                if (!cfg.onlyWrong || cfg.onlyWrong && msg.length) {
                    msg.unshift(`  - [ ] ${d.migrationItemUID}  `);
                    releases[release.version] = {
                        deprecations: msg
                    };
                }

            }, {});
            release.breakingChanges.forEach((b) => {
                const msg = [];

                if (!existingDeprecations[b.opponentMigrationItemUID]) {
                    msg.push(`    - [ ] [missing] ${b.opponentMigrationItemUID}  `);
                }

                if (!cfg.onlyWrong) {
                    msg.unshift(`  - [ ] ${b.migrationItemUID}`);
                    releases[release.version] = {
                        breakingChanges: msg
                    };
                }
            }, {});
            ++num;
        });

    const versions = Object.keys(releases);
    if (versions.length <= 0) {
        console.log('No errors detected');
        return;
    }
    versions.forEach((version) => {
        console.log(`- [ ] **${version}**  `);
        const deprecations = releases[version].deprecations;
        if (deprecations && deprecations.length) {
            console.log(`  - **Deprecations:**  `);
            deprecations.forEach(d => console.log(d));
        }
        const breakingChanges = releases[version].breakingChanges;
        if (breakingChanges && breakingChanges.length) {
            console.log(`  - **BreakingChanges:**  `);
            breakingChanges.forEach(b => console.log(b));
        }
    })

}

const s = new MigrationTimelineService();

s.migrations$
    .pipe(
        filter(l => !!l.length)
    )
    .subscribe(
        (list) => {
            const existingRelease = mapToExistingRelease(list);
            // console.log('existingRelease', Object.keys(existingRelease));
            const existingDeprecations = mapToExistingDeprecations(list);
            //console.log('existingDeprecations', Object.keys(existingDeprecations).length);
            const existingBreakingChanges = mapToExistingBreakingChanges(list);
            //console.log('existingBreakingChanges', Object.keys(existingBreakingChanges).length);
            const missingBreakingChanges = mapToMissingBreakingChanges(list, existingBreakingChanges);
            //console.log('missingBreakingChanges', Object.keys(missingBreakingChanges));
            const wrongDeprecationLink = mapToWrongDeprecationLink(existingDeprecations, existingBreakingChanges);
            //console.log('wrongDeprecationLink', Object.keys(wrongDeprecationLink));
            logChecklist(list);
        }
    );
s.fetchMigrationTimeline();

function getBreakingChangeFromDeprecation(d: Deprecation, r: { version: string, breakingChangeMsg: string }): BreakingChange {
    const b: BreakingChange = {
        itemType: 'breakingChange',
        subject: d.subject,
        subjectSymbol: d.subjectSymbol,
        subjectAction: d.breakingChangeSubjectAction,
        deprecationVersion: r.version,
        deprecationSubjectAction: d.subjectAction,
        breakingChangeMsg: r.breakingChangeMsg
    };
    return b;
}

