import {Observable, Subject} from "rxjs";
import {publish, publishReplay, refCount} from "rxjs/operators";

test('RxJs', () => {

    let state = 5;
    const subject = new Observable(observer => {
        // observer.next(state++);
        observer.next(state);
        observer.error("Greska")
        // observer.complete();
    }).pipe(
        publish(),
        refCount()
    );

    const getObserver = <T>(name: string) => ({
        next: (n: T) => console.log(name + ": " + n),
        error: (e: any) => console.log(name + ": " + e),
        complete: () => console.log(name + ": " + 'Competed')
    });


    subject.subscribe(getObserver("A"));
    subject.subscribe(getObserver("B"));
    subject.subscribe(getObserver("C"));
});

export {}
