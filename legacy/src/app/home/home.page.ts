import { Component, OnInit } from '@angular/core';
import { Plugins, Capacitor } from '@capacitor/core';
import { ModalController } from '@ionic/angular';

import { State } from '../models/state.model';
import { StateService } from '../services/state.service';
import { Points } from '../models/points.model';
import { Coordinates } from '../models/location.model';
import { QuizModalComponent } from '../shared/quiz-modal/quiz-modal.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage implements OnInit {
  states: State[] = [];
  points = new Points(0, 0, 0);
  pTotal = 0;
  distance: number;

  constructor(private stateService: StateService, public modalController: ModalController) {
    const p = stateService.getPoints()
      .then(pointTotals => {
        this.points = pointTotals;

        this.pTotal = this.points.state + this.points.question + this.points.distance;
      });

    const s = stateService.getStates()
      .then(stateList => {
        this.states = stateList;
      });
  }

  ngOnInit() { }

  onRefresh() {
    const s = this.stateService.resetStates()
      .then(stateList => {
        this.states = stateList;
      });

    this.stateService.removeItem('points')
      .then(resetValue => {
        const p = this.stateService.getPoints()
          .then(pointTotals => {
            this.points = pointTotals;

            this.pTotal = this.points.state + this.points.question + this.points.distance;
          });
      });
  }

  onFound(stateId: number) {
    this.states.find(st => st.ID === stateId);

    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < this.states.length; i++) {
      if (this.states[i].ID == stateId) {
        this.states[i].fnd.stateFound = true;

        this.calculateDistance(this.states[i])
          .then(rValue => {
            // console.log(Number(this.distance.toFixed(0)));
            this.states[i].fnd.distance = Number(this.distance.toFixed(0));
            this.stateService.setObject('states', JSON.stringify(this.states));

            this.points.state++;

            if ((this.distance > 0) && (this.distance <= 500)) {
              this.points.distance += 1;
            } else if ((this.distance <= 1000) && (this.distance >= 501)) {
              this.points.distance += 2;
            } else if ((this.distance <= 2000) && (this.distance >= 1001)) {
              this.points.distance += 3;
            } else if ((this.distance <= 3000) && (this.distance >= 2001)) {
              this.points.distance += 4;
            } else if (this.distance > 3000) {
              this.points.distance += 5;
            }

            this.stateService.setObject('points', JSON.stringify(this.points));
            this.pTotal = this.points.state + this.points.question + this.points.distance;
          });

        // Excludes DC from Quizes
        if (this.states[i].ID != 9) {
          const quizState: State[] = this.pickRndStates(this.states[i]);
          // console.log('Quiz States', quizState);

          this.createQuiz(this.states[i], quizState);
        }
      }
    }
  }

  async calculateDistance(state: State) {
    if (!Capacitor.isPluginAvailable('Geolocation')) {
      // console.log('Could not load plugin');
      return;
    }

    await Plugins.Geolocation.getCurrentPosition()
      .then(geoPosition => {
        const coordinates: Coordinates = {
          lat: geoPosition.coords.latitude,
          lng: geoPosition.coords.longitude
        };

        // console.log(coordinates);
        this.distance = this.calcCrow(state.Lat, state.Lng, coordinates.lat, coordinates.lng);
        // console.log(this.distance);
      })
      .catch(() => undefined);
  }

  private locateUser() {
    if (!Capacitor.isPluginAvailable('Geolocation')) {
      // console.log('Could not load plugin');
      return;
    }

    Plugins.Geolocation.getCurrentPosition()
      .then(geoPosition => {
        const coordinates: Coordinates = {
          lat: geoPosition.coords.latitude,
          lng: geoPosition.coords.longitude
        };
        // console.log(coordinates);
        return coordinates;
      })
      .catch(() => undefined);
  }

  calcCrow(lat1: number, long1: number, lat2: number, long2: number) {
    const R = 6371; // km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(long2 - long1);
    lat1 = this.toRad(lat1);
    lat2 = this.toRad(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d * 0.62137;
  }

  pickRndStates(start: State) {
    // console.log('Found State', start);
    const bird = start.Bird;
    const capital = start.Capital;
    const flower = start.Flower;
    const nickName = start.Nickname;
    const sId = start.ID;
    let compStates: State[] = [];
    let fcBirds: string[] = [];
    let fcCapital: string[] = [];
    let fcFlower: string[] = [];
    let fcNickName: string[] = [];
    let rndNum = [];
    let bCheck: boolean;
    let cCheck: boolean;
    let fCheck: boolean;
    let nnCheck: boolean;
    let cState: State;

    rndNum.push(sId);
    rndNum.push(8); // Exclude DC from random search
    fcBirds.push(bird);
    fcCapital.push(capital);
    fcFlower.push(flower);
    fcNickName.push(nickName);

    for (let i = 0; i < 3; i++) {
      do {
        const rState = this.getRndInteger(0, 50, rndNum);
        rndNum.push(rState);
        // console.log('Random Numbers', rndNum);

        // console.log('Brid Check 1', rState);
        // console.log('Brid Check 2', this.states[rState]);
        bCheck = this.birdCheck(this.states[rState].Bird, fcBirds);
        cCheck = this.capitalCheck(this.states[rState].Capital, fcCapital);
        fCheck = this.flowerCheck(this.states[rState].Flower, fcFlower);
        nnCheck = this.nickNameCheck(this.states[rState].Nickname, fcNickName);

        // console.log('Fact Checks', bCheck, cCheck, fCheck, nnCheck);
        cState = this.states[rState];
      } while ((!bCheck) || (!cCheck) || (!fCheck) || (!nnCheck));

      fcBirds.push(cState.Bird);
      // console.log('Fact Check States', compStates);
      compStates.push(cState);
    }

    // console.log('Array of states for quiz', compStates);
    return compStates;
  }

  // Exclude DC from Quiz!!
  createQuiz(foundState: State, quizStates: State[]) {
    let rndNum: number[] = [];
    let qOrder: string[] = [];
    let aOrder: string[] = [];
    let othOrder = [];

    // console.log('Found State', foundState);
    // console.log('Quiz States', quizStates);

    rndNum.push(8); // This Excludes DC from the Quiz build out
    for (let i = 0; i < 3; i++) {
      const rOrder = this.getRndInteger(1, 4, rndNum);
      rndNum.push(rOrder);
      let topic = '';
      if (rOrder == 1) {
        topic = 'Bird';
        aOrder.push(foundState.Bird);

        let othBird: string[] = [];
        for (let j = 0; j < 3; j++) {
          othBird.push(quizStates[j].Bird);
        }
        othOrder.push(othBird);
      } else if (rOrder == 2) {
        topic = 'Capital';
        aOrder.push(foundState.Capital);

        let othCap: string[] = [];
        for (let j = 0; j < 3; j++) {
          othCap.push(quizStates[j].Capital);
        }
        othOrder.push(othCap);
      } else if (rOrder == 3) {
        topic = 'Flower';
        aOrder.push(foundState.Flower);

        let othFlwr: string[] = [];
        for (let j = 0; j < 3; j++) {
          othFlwr.push(quizStates[j].Flower);
        }
        othOrder.push(othFlwr);
      } else if (rOrder == 4) {
        topic = 'Nick Name';
        aOrder.push(foundState.Nickname);

        let othNName: string[] = [];
        for (let j = 0; j < 3; j++) {
          othNName.push(quizStates[j].Nickname);
        }
        othOrder.push(othNName);
      }
      qOrder.push(topic);
    }

    // console.log('Quiz Order:', qOrder);
    // console.log('Answer Order', aOrder);
    // console.log('Other Order', othOrder);
    let modalResponses = [];
    const rndmNum: number[] = [];
    const aPos = this.getRndInteger(1, 4, rndmNum);
    this.showQuizModal(qOrder[0], aOrder[0], othOrder[0], aPos, foundState.Name, foundState.flagURL, 0)
      .then(r1 => {
        // console.log('Results', r1.data);
        modalResponses.push(r1.data);

        const bPos = this.getRndInteger(1, 4, rndmNum);
        this.showQuizModal(qOrder[1], aOrder[1], othOrder[1], bPos, foundState.Name, foundState.flagURL, r1.data)
          .then(r2 => {
            // console.log('Results', r2.data);
            modalResponses.push(r2.data);

            const cCount = modalResponses[0] + modalResponses[1];
            const cPos = this.getRndInteger(1, 4, rndmNum);
            this.showQuizModal(qOrder[2], aOrder[2], othOrder[2], cPos, foundState.Name, foundState.flagURL, cCount)
              .then(r3 => {
                // console.log('Results', r3.data);
                modalResponses.push(r3.data);

                // console.log('Full Modal Responses', modalResponses);

                this.onQuizComplete(modalResponses, foundState);
              });
          });
      });
  }

  onQuizComplete(quizResults: number[], foundState: State) {
    for (let i = 0; i < this.states.length; i++) {
      if (this.states[i].ID == foundState.ID) {
        const totalCorrect = quizResults[0] + quizResults[1] + quizResults[2];

        this.states[i].fnd.questionsCorrect = totalCorrect;

        this.stateService.setObject('states', JSON.stringify(this.states));

        this.points.question += totalCorrect;

        this.stateService.setObject('points', JSON.stringify(this.points));
        this.pTotal = this.points.state + this.points.question + this.points.distance;
      }
    }
  }

  // Converts numeric degrees to radians
  toRad(Value: number) {
    return Value * Math.PI / 180;
  }

  getRndInteger(min: number, max: number, exclude: number[]) {
    exclude = Array.isArray(exclude) ? exclude : [exclude];
    const rNum = Math.floor(Math.random() * max) + min;
    return exclude.includes(rNum) ? this.getRndInteger(max, min, exclude) : rNum;
  }

  birdCheck(compBird, fcb: string[]) {
    return fcb.includes(compBird) ? false : true;
  }

  capitalCheck(compCapital, fcc: string[]) {
    return fcc.includes(compCapital) ? false : true;
  }

  flowerCheck(compFlower, fcf: string[]) {
    return fcf.includes(compFlower) ? false : true;
  }

  nickNameCheck(compNName, fcnn: string[]) {
    return fcnn.includes(compNName) ? false : true;
  }

  // Exclude DC from Quiz!!
  // tslint:disable-next-line: max-line-length
  async showQuizModal(qTopic: string, ansr: string, otherOptions: string[], answerPos: number, fsName: string, image: string, cCount: number) {
    // console.log('QM Answer Pos', answerPos);
    const modal = await this.modalController.create({
      component: QuizModalComponent,
      componentProps: {
        topic: qTopic,
        answer: ansr,
        otherAnswers: otherOptions,
        answerPosition: answerPos,
        foundStateName: fsName,
        imageSrc: image,
        ratio: cCount
      }
    });

    modal.present();
    const qResult = await modal.onWillDismiss();
    return qResult;
  }
}
