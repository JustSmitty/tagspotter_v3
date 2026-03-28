import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, from, pipe } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Plugins } from '@capacitor/core';

import { State } from '../models/state.model';
import { Points } from '../models/points.model';

import statesFile from '../../data/states.json';

@Injectable({
  providedIn: 'root'
})
export class StateService implements OnDestroy {
  private states: State[] = [];
  private points = new Points(0, 0, 0);

  constructor() { }

  ngOnDestroy() { }

  async setObject(key: string, value: string) {
    await Plugins.Storage.set({
      key,
      value: JSON.stringify({ value })
    });
  }

  async getState(state: string) {
    const st = await Plugins.Storage.get({ key: state });
    return st;
  }

  async removeItem(item: string) {
    await Plugins.Storage.remove({ key: item });
  }

  async keys() {
    const keys = await Plugins.Storage.keys();
    return keys;
  }

  async clear() {
    await Plugins.Storage.clear();
  }

  public async getStates() {
    const storedData = await Plugins.Storage.get({ key: 'states' });
    if (!storedData || !storedData.value) {
      statesFile.forEach(data => {
        let s: State = data;
        this.states.push(s);
      });
      const stateInfo = JSON.stringify(this.states);
      this.setObject('states', stateInfo);
      return this.states;
    }
    // tslint:disable-next-line: one-line
    else {
      const parsedData = JSON.parse(storedData.value);
      const pd2 = JSON.parse(parsedData.value);
      // // tslint:disable-next-line: prefer-for-of
      // tslint:disable-next-line: prefer-for-of
      for (var i = 0; i < pd2.length; i++) {
        const s_1: State = pd2[i];
        this.states.push(s_1);
      }
      return this.states;
    }
  }

  public async resetStates() {
    this.states = [];
    const storedData = await Plugins.Storage.get({ key: 'states' });

    const parsedData = JSON.parse(storedData.value);
    const pd2 = JSON.parse(parsedData.value);
    // // tslint:disable-next-line: prefer-for-of
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < pd2.length; i++) {
      let s_1: State = pd2[i];
      s_1.fnd.distance = 0;
      s_1.fnd.lat = 0;
      s_1.fnd.lng = 0;
      s_1.fnd.questionsCorrect = 0;
      s_1.fnd.stateFound = false;
      this.states.push(s_1);
    }
    const stReset = JSON.stringify(this.states);
    this.setObject('states', stReset);

    return this.states;
  }

  // tslint:disable-next-line: adjacent-overload-signatures
  public getPoints() {
    return Plugins.Storage.get({ key: 'points' })
      .then(storedData => {
        if (!storedData || !storedData.value) {
          this.points = new Points(0, 0, 0);
          this.setObject('points', JSON.stringify(this.points));

          return this.points;
        } else {
          const pData = JSON.parse(storedData.value);
          this.points = JSON.parse(pData.value);

          return this.points;
        }
      });
  }
}
