/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from "@microsoft/mixed-reality-extension-sdk";
import fetch from "cross-fetch";

const TEXTHEIGHT = 0.3;
const TEXTDATAHEIGHT = 0.1;
const BUTTONWIDTH = 0.1;
const BACKGROUNDSIZE = { x: 6, y: 2 };
const XSCALESUBSCREENS = 0.5;
const YSCALESUBSCREENS = 1.5;

interface ScreenRecords {
	screens: MRE.Actor[];
	currentScreen: number;
}

/**
 * The main class of this app. All the logic goes here.
 */
export default class HelloWorld {
	// private button: MRE.Actor = null;
	private base: MRE.Actor = null;
	private waitingText: MRE.Actor = null;
	private assets: MRE.AssetContainer;
	private attachments = new Map<MRE.Guid, MRE.Actor>();

	constructor(private context: MRE.Context) {
		this.context.onStarted(() => this.started());
		this.context.onUserLeft((user) => this.userLeft(user));
		// this.context.onUserJoined((user) => this.userJoined(user));
	}

	// private userJoined(user: MRE.User) {
	// 	this.setVerification(user);
	// }

	/**
	 * Once the context is "started", initialize the app.
	 */
	private started() {
		// set up somewhere to store loaded assets (meshes, textures, animations, gltfs, etc.)
		this.assets = new MRE.AssetContainer(this.context);
		this.base = MRE.Actor.Create(this.context, {});
		const startButton = this.createButtonBox(
			"startButton",
			this.base.id,
			{ x: 0, y: 0, z: 0 },
			{ x: 0.8, y: 0.5, z: BUTTONWIDTH }
		);
		this.createBoxLabel("Start", startButton.id, 1, 1);

		const startingButtons = this.startingButtons(startButton);

		this.waitingText = this.createText(
			"Please wait a moment ...",
			"waitingText",
			null,
			MRE.TextAnchorLocation.MiddleCenter
		);
		this.waitingText.appearance.enabled = false;

		//buttons has to behave buttons
		startButton.setBehavior(MRE.ButtonBehavior).onClick(() => {
			this.showActor(startButton, false);
			this.showActor(startingButtons, true, 0);
		});
	}

	private startingButtons(startButton: MRE.Actor): MRE.Actor {
		const startingButtons = MRE.Actor.Create(this.context, {
			actor: {
				name: "startingButtons",
				parentId: this.base.id,
				appearance: { enabled: false },
			},
		});

		const backButton = this.createButtonBox(
			"backButton",
			startingButtons.id,
			{ x: -1, y: 0, z: 0 },
			{ x: 0.6, y: 0.4, z: BUTTONWIDTH }
		);
		this.createBoxLabel("back", backButton.id, 0.8, 1);

		const userIdentificationButton = this.createButtonBox(
			"userIdentification",
			startingButtons.id,
			{ x: 0, y: 0, z: 0 },
			{ x: 0.9, y: 0.5, z: BUTTONWIDTH }
		);
		this.createBoxLabel(
			"Check\n User",
			userIdentificationButton.id,
			0.7,
			0.8
		);

		const kybButton = this.createButtonBox(
			"intialButton",
			startingButtons.id,
			{ x: 1, y: 0, z: 0 },
			{ x: 0.9, y: 0.5, z: BUTTONWIDTH }
		);
		this.createBoxLabel("KYB", kybButton.id, 0.8, 1);

		// Buttons actions
		kybButton
			.setBehavior(MRE.ButtonBehavior)
			.onClick((user) => this.promptKYB(user));
		backButton.setBehavior(MRE.ButtonBehavior).onClick(() => {
			this.showActor(startingButtons, false);
			this.showActor(startButton, true, 0);
		});
		userIdentificationButton
			.setBehavior(MRE.ButtonBehavior)
			.onClick((user) => {
				this.autenticateUser(user);
			});

		return startingButtons;
	}

	private autenticateUser(user: MRE.User) {
		console.log(`${user.name} start the user autentication`);
		let names: string[];

		const startButton = this.base.findChildrenByName(
			"startButton",
			true
		)[0];

		user.prompt(
			`You are about to "prove" your identity
		Please provide your phone number and in short we'll ask you to provide your name
		If the data match in our database, you are good to go
		Are you ready?`,
			false
		)
			.then((userAccept) => {
				if (userAccept.submitted) {
					return user.prompt("Provide a phone number", true);
				} else {
					console.log("user canceled autentication");
				}
			})
			.then(async (phone) => {
				if (phone.submitted && phone.text.length > 0) {
					this.showActor(this.waitingText, true);
					const startingButtons = this.base.findChildrenByName(
						"startingButtons",
						true
					)[0];
					this.showActor(startingButtons, false);
					const personConsult = await this.searchPerson(phone.text);
					this.showActor(this.waitingText, false);
					if (personConsult.code === 200) {
						names = this.getNamesFromPerson(personConsult);
						return user.prompt("Awesome! What is your name?", true);
					} else {
						user.prompt(
							"We could not find any record with your data"
						);
						this.showActor(startButton, true);
					}
				} else if (phone.submitted) {
					user.prompt("The phone number is necesary", false);
				} else {
					console.log("user canceled phone number");
				}
			})
			.then((name) => {
				if (name.submitted && name.text.length > 0) {
					if (this.compareName(names, name.text)) {
						user.prompt(
							"Alright! your identity has been verified :)"
						);
						this.setVerification(user);
					} else {
						user.prompt("Ops! looks like something is wrong");
					}
				} else if (name.submitted) {
					user.prompt(
						"Your name is necessary for the authentication",
						false
					);
				} else {
					console.log("user canceled in name query");
				}
			})
			.then(() => {
				this.showActor(startButton, true);
			})
			.catch((err) => {
				console.log(err);
			});
	}

	private setVerification(user: MRE.User) {
		const verificationMarks = MRE.Actor.Create(this.context, {
			actor: {
				attachment: {
					attachPoint: "head",
					userId: user.id,
				},
			},
		});
		this.attachments.set(user.id, verificationMarks);

		MRE.Actor.Create(this.context, {
			actor: {
				parentId: verificationMarks.id,
				name: "headMark",
				text: {
					contents: "verified",
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					color: { r: 36 / 255, g: 138 / 255, b: 25 / 255 },
				},
				transform: {
					local: {
						position: { x: 0.047, y: 0.05, z: 0.12 },
						scale: { x: 0.004, y: 0.004, z: 0.004 },
					},
				},
			},
		});
		MRE.Actor.CreateFromLibrary(this.context, {
			actor: {
				parentId: verificationMarks.id,
				name: "headMark",
				transform: {
					local: {
						position: { x: 0, y: 0.35, z: 0 },
						scale: { x: 0.4, y: 0.4, z: 0.4 },
					},
				},
			},
			resourceId: "artifact:1579239603192201565",
		});
	}

	private async searchPerson(phone: string): Promise<any> {
		const personConsult = await fetch(
			"https://nufi.azure-api.net/enriquecimientoinformacion/v1/busqueda",
			{
				method: "POST",
				headers: {
					"Conteng-Type": "application/json",
					"Ocp-Apim-Subscription-Key":
						"dfabbcc369324f2b9628cfa9fb63211a",
				},
				body: `{"telefono": "${phone}"}`,
			}
		)
			.then((res) => res.json())
			.then((res) => {
				console.log("Person consult ready");
				return res;
			});

		return personConsult;
	}
	private getNamesFromPerson(personConsult: {
		data: {
			person: { names: Array<{ display: string }> };
			Name: { display: string };
		};
	}): string[] {
		console.log("person:", personConsult);
		const names = [];
		try {
			names.push(personConsult.data.Name.display);
		} catch (error) {
			console.log(error);
		}
		try {
			names.push(personConsult.data.Name.display);
		} catch (error) {
			console.log(error);
		}

		console.log("names:", names);
		return names;
	}

	private compareName(names: string[], name: string): boolean {
		let nameMatch = false;
		name = name.toLowerCase();
		for (const nameObtained of names) {
			if (nameObtained.toLowerCase().includes(name)) {
				nameMatch = true;
				break;
			}
		}
		return nameMatch;
	}

	private promptKYB(user: MRE.User) {
		let companyName: string;
		let rfc: string;
		let brand: string;
		console.log(`${user.name} has pressed the button`);
		user.prompt(
			`Welcome to your everyday KYB VR!
			Please insert the name of the company or person`,
			// 	`Bienvenido a su KYB VR
			// Por favor introduzca la Razón Social:`,
			true
		)
			.then((compNameRes) => {
				if (compNameRes.submitted && compNameRes.text.length > 0) {
					companyName = compNameRes.text;
					return user.prompt(`Introduce the RFC:`, true);
				} else if (compNameRes.submitted) {
					user.prompt(
						"Sorry, but the name is necessary for the search"
						// "Lo sentimos pero la razón Social es necesaria para la busqueda"
					);
				} else {
					console.log("user cancelled in company name");
					return null;
				}
			})
			.then((rfcRes) => {
				if (rfcRes.submitted && rfcRes.text.length > 0) {
					rfc = rfcRes.text;
					return user.prompt(`Introduce the brand`, true);
				} else if (rfcRes.submitted) {
					user.prompt(
						"Sorry, but the RFC is necessary for the search"
						// "Lo sentimos pero el RFC es necesario para la busqueda"
					);
				} else {
					console.log("user canceled in rfc");
					return null;
				}
			})
			.then((brandRes) => {
				if (brandRes.submitted && brandRes.text.length > 0) {
					brand = brandRes.text;
				} else if (brandRes.submitted) {
					brand = null;
				} else {
					console.log("user canceled in brand");
					return null;
				}
				this.kybSearch(companyName, rfc, brand);
			})
			.catch((err) => {
				console.log(err);
			});
	}

	private kybSearch(companyName: string, rfc: string, brand: string) {
		// console.log(companyName, rfc, brand);
		const startingButtons = this.base.findChildrenByName(
			"startingButtons",
			true
		)[0];
		this.showActor(startingButtons, false, 0);
		this.showActor(this.waitingText, true);

		this.consult(companyName, brand, rfc).then((res) => {
			this.createOptions();
			this.showActor(this.waitingText, false);
			this.createOptionsData(res.sat, res.brands);
		});
	}

	private async consult(
		companyName: string,
		brand: string,
		rfc: string
	): Promise<any> {
		let brandsConsult: Promise<any>;
		if (brand) {
			brandsConsult = fetch(
				"https://nufi.azure-api.net/trademark/v1/find",
				{
					method: "POST",
					headers: {
						"Conteng-Type": "application/json",
						"Ocp-Apim-Subscription-Key":
							"dfabbcc369324f2b9628cfa9fb63211a",
					},
					body: `{"name": "${brand}"}`,
				}
			)
				.then((res) => res.json())
				.then((res) => {
					console.log("Brands ready");
					return res;
				});
		} else {
			brandsConsult = Promise.resolve(null);
		}

		const satConsult = fetch(
			"https://nufi.azure-api.net/contribuyentes/v2/consultar",
			{
				method: "POST",
				headers: {
					"Conteng-Type": "application/json",
					"NUFI-API-KEY": "dfabbcc369324f2b9628cfa9fb63211a",
				},
				body: `{"name": "${companyName}", "rfc": "${rfc}"}`,
			}
		)
			.then((res) => res.json())
			.then((res) => {
				console.log("SAT ready");
				return res;
			});

		let brands: object;
		let sat: object;

		const ress = await Promise.allSettled([satConsult, brandsConsult]);
		if (ress[0].status === "fulfilled") {
			console.log("brands fullfilled");
			brands = brandsConsult;
		} else {
			brands = null;
			console.log("brands rejected");
		}
		if (ress[1].status === "fulfilled") {
			console.log("sat fulfilled");
			sat = satConsult;
		} else {
			console.log("sat rejected");
			sat = null;
		}
		return { brands: brands, sat: sat };
	}

	private createOptions() {
		const baseOptions = MRE.Actor.Create(this.context, {
			actor: {
				name: "baseOptions",
				parentId: this.base.id,
			},
		});

		const satButtonBox = this.createButtonBox(
			"satButton",
			baseOptions.id,
			{ x: -0.5, y: 0, z: 0 },
			{ x: 0.9, y: 1.5, z: BUTTONWIDTH }
		);
		this.createBoxLabel("SAT", satButtonBox.id, 1, 0.5);
		satButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.showSAT());

		const impiButtonBox = this.createButtonBox(
			"impiButton",
			baseOptions.id,
			{ x: 0.5, y: 0, z: 0 },
			{ x: 0.9, y: 1.5, z: BUTTONWIDTH }
		);
		this.createBoxLabel("IMPI", impiButtonBox.id, 1, 0.5);
		impiButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.showIMPI());

		const exitButtonBox = this.createButtonBox(
			"newSearch",
			baseOptions.id,
			{ x: 0, y: 1, z: 0 },
			{ x: 0.6, y: 0.4, z: BUTTONWIDTH }
		);
		this.createBoxLabel("Exit", exitButtonBox.id, 1, 1.6);
		exitButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.exitKYB());
	}

	private createOptionsData(
		sat: Promise<any>,
		brands: Promise<any>
	): MRE.Actor {
		const baseOptionsData = MRE.Actor.Create(this.context, {
			actor: {
				name: "baseOptionsData",
				parentId: this.base.id,
				appearance: { enabled: false },
				transform: {
					local: {
						position: {
							x: 0,
							y: 10,
							z: 0,
						},
					},
				},
			},
		});

		// This is the background for the data
		this.createButtonBox(
			"dataBackground",
			baseOptionsData.id,
			{ x: (BACKGROUNDSIZE.x - 3) / 2, y: 0, z: 0 },
			{ x: BACKGROUNDSIZE.x, y: BACKGROUNDSIZE.y, z: 0.02 }
		);

		const satButtonBox = this.createButtonBox(
			"satButton",
			baseOptionsData.id,
			{ x: -0.9, y: 1.5, z: 0 },
			{ x: 0.7, y: 0.4, z: BUTTONWIDTH }
		);
		this.createBoxLabel("SAT", satButtonBox.id, 1.1, 1.7);
		satButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.showSAT());
		const satBody = MRE.Actor.Create(this.context, {
			actor: {
				name: "satBody",
				parentId: baseOptionsData.id,
				appearance: { enabled: false },
				transform: {
					local: {
						position: {
							x: 0,
							y: 0,
							z: -0.05,
						},
					},
				},
			},
		});
		this.fillSatBody(satBody, sat);

		const impiButtonBox = this.createButtonBox(
			"impiButton",
			baseOptionsData.id,
			{ x: 0.9, y: 1.5, z: 0 },
			{ x: 0.7, y: 0.4, z: BUTTONWIDTH }
		);
		this.createBoxLabel("IMPI", impiButtonBox.id, 1.1, 1.7);
		impiButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.showIMPI());
		const impiBody = MRE.Actor.Create(this.context, {
			actor: {
				name: "impiBody",
				parentId: baseOptionsData.id,
				appearance: { enabled: false },
				transform: {
					local: {
						position: {
							x: 0,
							y: 0,
							z: -0.05,
						},
					},
				},
			},
		});
		this.fillImpiBody(impiBody, brands);

		const exitButtonBox = this.createButtonBox(
			"newSearch",
			baseOptionsData.id,
			{ x: 0, y: 1.5, z: 0 },
			{ x: 0.6, y: 0.4, z: BUTTONWIDTH }
		);
		this.createBoxLabel("Exit", exitButtonBox.id, 1, 1.6);
		exitButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.exitKYB());

		return baseOptionsData;
	}
	private showIMPI() {
		this.destroyActorInBase("baseOptions");
		const baseOptionsData = this.base.findChildrenByName(
			"baseOptionsData",
			true
		)[0];
		this.showActor(baseOptionsData, true, 0);
		this.showActor(
			baseOptionsData.findChildrenByName("satBody", true)[0],
			false
		);
		this.showActor(
			baseOptionsData.findChildrenByName("impiBody", true)[0],
			true,
			0
		);
	}

	private showSAT() {
		this.destroyActorInBase("baseOptions");
		const baseOptionsData = this.base.findChildrenByName(
			"baseOptionsData",
			true
		)[0];
		this.showActor(baseOptionsData, true, 0);
		this.showActor(
			baseOptionsData.findChildrenByName("impiBody", true)[0],
			false
		);
		this.showActor(
			baseOptionsData.findChildrenByName("satBody", true)[0],
			true,
			0
		);
	}

	private async fillSatBody(satBody: MRE.Actor, satPromise: Promise<any>) {
		const sat = await satPromise.then((res) => {
			return res;
		});
		if (sat.code === 204) {
			this.createText(
				`message: "${sat.message}"`,
				"message",
				satBody.id,
				MRE.TextAnchorLocation.TopLeft,
				{ x: -1.4, y: BACKGROUNDSIZE.y / 2 - 0.1, z: 0 },
				TEXTDATAHEIGHT
			);
			return;
		} else if (sat.code === 200) {
			const screens = new Array<MRE.Actor>();
			// sat.data.push({
			// 	juanito: "alimana",
			// 	carrancho: "narices de gancho",
			// });
			sat.data.forEach((record: object, index: number) => {
				const screen = MRE.Actor.Create(this.context, {
					actor: {
						parentId: satBody.id,
						appearance: { enabled: false },
						transform: {
							local: { position: { x: -1.4, y: 0.9, z: 0 } },
						},
					},
				});
				screens.push(screen);
				this.createText(
					`${index + 1}/${sat.data.length}`,
					"numerator",
					screen.id,
					MRE.TextAnchorLocation.MiddleCenter,
					{ x: 1.4, y: 0.2, z: 0 },
					0.2
				);
				let textYPos = 0;
				let i = 0;
				for (const [key, value] of Object.entries(record)) {
					this.createText(
						`${key}: ${value}`,
						`satDataField${i}`,
						screen.id,
						MRE.TextAnchorLocation.TopLeft,
						{ x: 0, y: textYPos, z: 0 },
						TEXTDATAHEIGHT,
						{ r: 1, g: 1, b: 1 }
					);
					textYPos -= TEXTDATAHEIGHT;
					i += 1;
				}
			});
			let currentScreen = 0;
			screens[currentScreen].appearance.enabled = true;

			const nextButtonBox = this.createButtonBox(
				"satNext",
				satBody.id,
				{ x: -2, y: 0.3, z: 0 },
				{ x: 0.8, y: 0.5, z: BUTTONWIDTH }
			);
			this.createBoxLabel("Next", nextButtonBox.id, 1, 1.5);
			nextButtonBox.setBehavior(MRE.ButtonBehavior).onClick(() => {
				screens[currentScreen].appearance.enabled = false;
				currentScreen = (currentScreen + 1) % screens.length;
				screens[currentScreen].appearance.enabled = true;
			});
			const prevButtonBox = this.createButtonBox(
				"satNext",
				satBody.id,
				{ x: -2, y: -0.3, z: 0 },
				{ x: 0.8, y: 0.5, z: BUTTONWIDTH }
			);
			this.createBoxLabel("Prev", prevButtonBox.id, 1, 1.5);
			prevButtonBox.setBehavior(MRE.ButtonBehavior).onClick(() => {
				screens[currentScreen].appearance.enabled = false;
				currentScreen = (currentScreen - 1) % screens.length;
				currentScreen =
					currentScreen === -1 ? screens.length - 1 : currentScreen;
				screens[currentScreen].appearance.enabled = true;
			});
		}
	}

	private async fillImpiBody(impiBody: MRE.Actor, impiPromise: Promise<any>) {
		const impi = await impiPromise.then((res) => {
			return res;
		});
		if (!impi) {
			this.createText(
				"No brand consult was perfomed",
				"message",
				impiBody.id,
				MRE.TextAnchorLocation.TopLeft,
				{ x: -1.4, y: BACKGROUNDSIZE.y / 2 - 0.1, z: 0 },
				TEXTDATAHEIGHT
			);
			return;
		} else if (impi.code === 204) {
			this.createText(
				impi.message,
				"message",
				impiBody.id,
				MRE.TextAnchorLocation.TopLeft,
				{ x: -1.4, y: BACKGROUNDSIZE.y / 2 - 0.1, z: 0 },
				TEXTDATAHEIGHT
			);
			return;
		} else if (impi.code === 200) {
			const impiRecords = MRE.Actor.Create(this.context, {
				actor: {
					name: "impiRecords",
					parentId: impiBody.id,
				},
			});
			const screensToNavigate: ScreenRecords = {
				screens: null,
				currentScreen: 0,
			};

			const { mainScreens, proceduresArrays, pAndSArrays } =
				this.createImpiScreens(impi.data, impiRecords);

			// Buttons
			let currentMainScreen = 0;

			// Buttons to show Products and Services
			let showPandS = false;
			const psButtonBox = this.createButtonBox(
				"psBox",
				impiRecords.id,
				{ x: -2, y: 0.8, z: 0 },
				{ x: 0.8, y: 0.4, z: BUTTONWIDTH }
			);
			const psButtonLabel = this.createBoxLabel(
				"Products and\nServices",
				psButtonBox.id,
				XSCALESUBSCREENS,
				YSCALESUBSCREENS
			);
			// Button to show procedures
			let showProcedure = false;
			const proceduresButtonBox = this.createButtonBox(
				"proceduresBox",
				impiRecords.id,
				{ x: -2, y: 0.3, z: 0 },
				{ x: 0.8, y: 0.4, z: BUTTONWIDTH }
			);
			const proceduresButtonLabel = this.createBoxLabel(
				"Procedures",
				proceduresButtonBox.id,
				XSCALESUBSCREENS,
				YSCALESUBSCREENS
			);

			// procedures and products & Services buttons behaviors
			psButtonBox.setBehavior(MRE.ButtonBehavior).onClick(() => {
				if (showProcedure) {
					const changeSubScreen = this.showSubScreen(
						showProcedure,
						proceduresButtonLabel,
						screensToNavigate,
						mainScreens,
						currentMainScreen,
						proceduresArrays,
						"Procedures"
					);
					showProcedure = changeSubScreen.showingAlready;
					currentMainScreen = changeSubScreen.currentMainScreen;
				}
				const changeSubScreen = this.showSubScreen(
					showPandS,
					psButtonLabel,
					screensToNavigate,
					mainScreens,
					currentMainScreen,
					pAndSArrays,
					"Product And\nServices"
				);
				showPandS = changeSubScreen.showingAlready;
				currentMainScreen = changeSubScreen.currentMainScreen;
			});

			proceduresButtonBox.setBehavior(MRE.ButtonBehavior).onClick(() => {
				if (showPandS) {
					const changeSubScreen = this.showSubScreen(
						showPandS,
						psButtonLabel,
						screensToNavigate,
						mainScreens,
						currentMainScreen,
						pAndSArrays,
						"Product And\nServices"
					);
					showPandS = changeSubScreen.showingAlready;
					currentMainScreen = changeSubScreen.currentMainScreen;
				}
				const changeSubScreen = this.showSubScreen(
					showProcedure,
					proceduresButtonLabel,
					screensToNavigate,
					mainScreens,
					currentMainScreen,
					proceduresArrays,
					"Procedures"
				);
				showProcedure = changeSubScreen.showingAlready;
				currentMainScreen = changeSubScreen.currentMainScreen;
			});

			// Buttons to move between records
			screensToNavigate.screens = mainScreens;
			screensToNavigate.currentScreen = currentMainScreen;

			mainScreens[currentMainScreen].appearance.enabled = true;
			const nextButtonBox = this.createButtonBox(
				"impiNext",
				impiRecords.id,
				{ x: -2, y: -0.2, z: 0 },
				{ x: 0.8, y: 0.4, z: BUTTONWIDTH }
			);
			this.createBoxLabel("Next", nextButtonBox.id, 1, 1.8);
			nextButtonBox.setBehavior(MRE.ButtonBehavior).onClick(() => {
				screensToNavigate.screens[
					screensToNavigate.currentScreen
				].appearance.enabled = false;
				screensToNavigate.currentScreen =
					(screensToNavigate.currentScreen + 1) %
					screensToNavigate.screens.length;
				screensToNavigate.screens[
					screensToNavigate.currentScreen
				].appearance.enabled = true;
			});
			const prevButtonBox = this.createButtonBox(
				"impiPrev",
				impiRecords.id,
				{ x: -2, y: -0.7, z: 0 },
				{ x: 0.8, y: 0.4, z: BUTTONWIDTH }
			);
			this.createBoxLabel("Prev", prevButtonBox.id, 1, 1.8);
			prevButtonBox.setBehavior(MRE.ButtonBehavior).onClick(() => {
				screensToNavigate.screens[
					screensToNavigate.currentScreen
				].appearance.enabled = false;
				screensToNavigate.currentScreen =
					(screensToNavigate.currentScreen - 1) %
					screensToNavigate.screens.length;
				screensToNavigate.currentScreen =
					screensToNavigate.currentScreen === -1
						? screensToNavigate.screens.length - 1
						: screensToNavigate.currentScreen;
				screensToNavigate.screens[
					screensToNavigate.currentScreen
				].appearance.enabled = true;
			});
		}
	}

	private createImpiScreens(
		data: object[],
		impiRecords: MRE.Actor
	): {
		mainScreens: MRE.Actor[];
		proceduresArrays: MRE.Actor[][];
		pAndSArrays: MRE.Actor[][];
	} {
		const mainScreens = new Array<MRE.Actor>();
		const proceduresArrays = new Array<MRE.Actor[]>();
		const pAndSArrays = new Array<MRE.Actor[]>();
		data.forEach((record: object, index: number) => {
			const screen = MRE.Actor.Create(this.context, {
				actor: {
					parentId: impiRecords.id,
					appearance: { enabled: false },
					transform: {
						local: { position: { x: -1.4, y: 0.9, z: 0 } },
					},
				},
			});
			mainScreens.push(screen);
			this.createText(
				`Brand: ${index + 1}/${data.length}`,
				"numerator",
				screen.id,
				MRE.TextAnchorLocation.MiddleCenter,
				{ x: 1.4, y: 0.2, z: 0 },
				0.2
			);
			let textYPos = 0;
			let i = 0;
			for (const [key, value] of Object.entries(record)) {
				if (typeof value === "object") {
					if (Array.isArray(value)) {
						this.createText(
							`${key}: ${value.length} ${
								value.length !== 1 ? "items" : "item"
							}`,
							`satDataField${i}`,
							screen.id,
							MRE.TextAnchorLocation.TopLeft,
							{ x: 0, y: textYPos, z: 0 },
							TEXTDATAHEIGHT,
							{ r: 1, g: 1, b: 1 }
						);
						textYPos -= TEXTDATAHEIGHT;
						if (key === "procedures") {
							const proceduresRecord = this.createSubScreens(
								value,
								impiRecords.id,
								"Procedures"
							);
							proceduresArrays.push(proceduresRecord);
						} else if (key === "productsAndServices") {
							const pasRecord = this.createSubScreens(
								value,
								impiRecords.id,
								"Product and/or Service"
							);
							pAndSArrays.push(pasRecord);
						}
					} else {
						this.createText(
							`${key}:`,
							`satDataField${i}`,
							screen.id,
							MRE.TextAnchorLocation.TopLeft,
							{ x: 0, y: textYPos, z: 0 },
							TEXTDATAHEIGHT,
							{ r: 1, g: 1, b: 1 }
						);
						textYPos -= TEXTDATAHEIGHT;
						for (const [okey, ovalue] of Object.entries(value)) {
							this.createText(
								`        ${okey}: ${ovalue}`,
								`satDataField${i}`,
								screen.id,
								MRE.TextAnchorLocation.TopLeft,
								{ x: 0, y: textYPos, z: 0 },
								TEXTDATAHEIGHT,
								{ r: 1, g: 1, b: 1 }
							);
							textYPos -= TEXTDATAHEIGHT;
						}
					}
				} else {
					this.createText(
						`${key}: ${value}`,
						`satDataField${i}`,
						screen.id,
						MRE.TextAnchorLocation.TopLeft,
						{ x: 0, y: textYPos, z: 0 },
						TEXTDATAHEIGHT,
						{ r: 1, g: 1, b: 1 }
					);
					textYPos -= TEXTDATAHEIGHT;
				}
				i += 1;
			}
		});
		return { mainScreens, proceduresArrays, pAndSArrays };
	}

	private createSubScreens(
		records: object[],
		parentId: MRE.Guid,
		name: string
	): MRE.Actor[] {
		const subScreens = new Array<MRE.Actor>();
		let screenCount = 0;
		for (const record of records) {
			const recordScreen = MRE.Actor.Create(this.context, {
				actor: {
					parentId: parentId,
					appearance: { enabled: false },
					transform: {
						local: {
							position: {
								x: -1.4,
								y: 0.9,
								z: 0,
							},
						},
					},
				},
			});
			screenCount += 1;
			this.createText(
				`${name}: ${screenCount}/${records.length}`,
				"numerator",
				recordScreen.id,
				MRE.TextAnchorLocation.MiddleCenter,
				{ x: 1.4, y: 0.2, z: 0 },
				0.2
			);
			let yPos = 0;
			for (const [pkey, pvalue] of Object.entries(record)) {
				this.createText(
					`        ${pkey}: ${pvalue}`,
					`satDataField`,
					recordScreen.id,
					MRE.TextAnchorLocation.TopLeft,
					{ x: 0, y: yPos, z: 0 },
					TEXTDATAHEIGHT,
					{ r: 1, g: 1, b: 1 }
				);
				yPos -= TEXTDATAHEIGHT;
			}
			subScreens.push(recordScreen);
		}
		return subScreens;
	}

	private showSubScreen(
		showingAlready: boolean,
		buttonLabel: MRE.Actor,
		screensToNavigate: ScreenRecords,
		mainScreens: MRE.Actor[],
		currentMainScreen: number,
		subScreenArrays: MRE.Actor[][],
		changingLabel: string
	): { showingAlready: boolean; currentMainScreen: number } {
		if (showingAlready) {
			buttonLabel.transform.local.scale.x = XSCALESUBSCREENS;
			buttonLabel.transform.local.scale.y = YSCALESUBSCREENS;
			buttonLabel.text.contents = changingLabel;
			buttonLabel.text.color = { r: 0, g: 0, b: 0 };
			screensToNavigate.screens[
				screensToNavigate.currentScreen
			].appearance.enabled = false;
			screensToNavigate.screens = mainScreens;
			screensToNavigate.currentScreen = currentMainScreen;
			screensToNavigate.screens[
				screensToNavigate.currentScreen
			].appearance.enabled = true;
			showingAlready = false;
		} else {
			buttonLabel.transform.local.scale.x = 1;
			buttonLabel.transform.local.scale.y = 1.5;
			buttonLabel.text.contents = "Back";
			buttonLabel.text.color = { r: 0.4, g: 0.4, b: 0 };
			screensToNavigate.screens[
				screensToNavigate.currentScreen
			].appearance.enabled = false;
			screensToNavigate.screens =
				subScreenArrays[screensToNavigate.currentScreen];
			currentMainScreen = screensToNavigate.currentScreen;
			screensToNavigate.currentScreen = 0;
			screensToNavigate.screens[
				screensToNavigate.currentScreen
			].appearance.enabled = true;
			showingAlready = true;
		}
		return { showingAlready, currentMainScreen };
	}

	private showActor(actor: MRE.Actor, show: boolean, y = 0) {
		actor.appearance.enabled = show;
		actor.transform.local.position.y = show ? y : 10;
	}

	private createText(
		contents: string,
		name: string,
		parentId: MRE.Guid,
		anchor: MRE.TextAnchorLocation = MRE.TextAnchorLocation.TopLeft,
		position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
		height: number = TEXTHEIGHT,
		color: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 }
	) {
		return MRE.Actor.Create(this.context, {
			actor: {
				name: name,
				parentId: parentId,
				text: {
					contents: contents,
					anchor: anchor,
					color: color,
					height: height,
				},
				transform: {
					local: {
						position: position,
					},
				},
			},
		});
	}

	private destroyActorInBase(name: string) {
		const actor = this.base.findChildrenByName(name, true);
		if (actor.length > 0) {
			actor[0].destroy();
		}
	}

	private exitKYB() {
		const baseOptions = this.base.findChildrenByName("baseOptions", true);
		if (baseOptions.length > 0) {
			baseOptions[0].destroy();
		}
		const baseOptionsData = this.base.findChildrenByName(
			"baseOptionsData",
			true
		);
		if (baseOptionsData.length > 0) {
			baseOptionsData[0].destroy();
		}
		const startingButtons = this.base.findChildrenByName(
			"startingButtons",
			true
		)[0];
		this.showActor(startingButtons, true, 0);
	}

	private createButtonBox(
		name: string,
		parentId: MRE.Guid,
		position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
		scale: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
	): MRE.Actor {
		const box = MRE.Actor.CreatePrimitive(this.assets, {
			definition: { shape: MRE.PrimitiveShape.Box },
			actor: {
				parentId: parentId,
				name: name,
				collider: { geometry: { shape: MRE.ColliderType.Auto } },
				transform: {
					local: {
						scale: scale,
						position: position,
					},
				},
			},
		});
		box.setBehavior(MRE.ButtonBehavior);
		//nice hover in button
		// boxBehavior.onHover("enter", () => {
		// 	// use the convenience function "AnimateTo" instead of creating the animation data in advance
		// 	MRE.Animation.AnimateTo(this.context, box, {
		// 		destination: {
		// 			transform: {
		// 				local: {
		// 					scale: {
		// 						x: scale.x + 1,
		// 						y: scale.y + 0.1,
		// 						z: scale.z + 0.1,
		// 					},
		// 				},
		// 			},
		// 		},
		// 		duration: 0.3,
		// 		easing: MRE.AnimationEaseCurves.EaseOutSine,
		// 	});
		// });
		// boxBehavior.onHover("exit", () => {
		// 	MRE.Animation.AnimateTo(this.context, box, {
		// 		destination: {
		// 			transform: {
		// 				local: { scale: scale },
		// 			},
		// 		},
		// 		duration: 0.3,
		// 		easing: MRE.AnimationEaseCurves.EaseOutSine,
		// 	});
		// });
		return box;
	}

	private createBoxLabel(
		label: string,
		parentId: MRE.Guid,
		xScale: number,
		yScale: number
	): MRE.Actor {
		return MRE.Actor.Create(this.context, {
			actor: {
				parentId: parentId,
				name: "buttonlabel",
				text: {
					contents: label,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					color: { r: 0, g: 0, b: 0 },
					height: TEXTHEIGHT,
				},
				transform: {
					local: {
						position: { x: 0, y: 0, z: -0.6 },
						scale: { x: xScale, y: yScale, z: 1 },
					},
				},
			},
		});
	}

	private consultMock(
		companyName: string,
		brand: string,
		rfc: string
	): Promise<any> {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(3);
			}, 500);
		});
	}

	private userLeft(user: MRE.User) {
		console.log(`${user.name} left :(`);

		if (this.attachments.has(user.id)) {
			const attachment = this.attachments.get(user.id);

			attachment.detach();

			attachment.destroy();

			this.attachments.delete(user.id);
		}
	}
}
