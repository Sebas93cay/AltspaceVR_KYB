/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRE from "@microsoft/mixed-reality-extension-sdk";
import { ButtonBehavior } from "@microsoft/mixed-reality-extension-sdk";
import fetch from "cross-fetch";

const TEXTHEIGHT = 0.3;
const BUTTONWIDTH = 0.1;

/**
 * The main class of this app. All the logic goes here.
 */
export default class HelloWorld {
	// private button: MRE.Actor = null;
	private base: MRE.Actor = null;
	private startButton: MRE.Actor = null;
	private assets: MRE.AssetContainer;

	constructor(private context: MRE.Context) {
		this.context.onStarted(() => this.started());
	}

	/**
	 * Once the context is "started", initialize the app.
	 */
	private started() {
		// set up somewhere to store loaded assets (meshes, textures, animations, gltfs, etc.)
		this.assets = new MRE.AssetContainer(this.context);
		this.base = MRE.Actor.Create(this.context, {});
		this.startButton = this.createButtonBox(
			"IntialButton",
			null,
			0,
			0,
			0,
			0.9,
			0.5,
			BUTTONWIDTH
		);
		this.createBoxLabel("KYB", this.startButton.id, 1, 1);

		//button has to behave as a button
		const buttonBehavior = this.startButton.setBehavior(MRE.ButtonBehavior);

		//nice hover in button
		buttonBehavior.onHover("enter", () => {
			// use the convenience function "AnimateTo" instead of creating the animation data in advance
			MRE.Animation.AnimateTo(this.context, this.startButton, {
				destination: {
					transform: {
						local: { scale: { x: 1, y: 0.6, z: BUTTONWIDTH } },
					},
				},
				duration: 0.3,
				easing: MRE.AnimationEaseCurves.EaseOutSine,
			});
		});
		buttonBehavior.onHover("exit", () => {
			MRE.Animation.AnimateTo(this.context, this.startButton, {
				destination: {
					transform: {
						local: { scale: { x: 0.9, y: 0.5, z: BUTTONWIDTH } },
					},
				},
				duration: 0.3,
				easing: MRE.AnimationEaseCurves.EaseOutSine,
			});
		});
		buttonBehavior.onClick((user) => this.promptKYB(user));
	}

	private promptKYB(user: MRE.User) {
		let companyName: string;
		let rfc: string;
		let brand: string;
		console.log(`${user.name} has pressed the button`);
		user.prompt(
			`Bienvenido a su KYB VR
		Por favor introduzca la Razón Social:`,
			true
		)
			.then((compNameRes) => {
				if (compNameRes.submitted && compNameRes.text.length > 0) {
					companyName = compNameRes.text;
					return user.prompt(`Introdusca el RFC:`, true);
				} else if (compNameRes.submitted) {
					user.prompt(
						"Lo sentimos pero la razón Social es necesaria para la busqueda"
					);
				} else {
					console.log("user cancelled in company name");
					return null;
				}
			})
			.then((rfcRes) => {
				if (rfcRes.submitted && rfcRes.text.length > 0) {
					rfc = rfcRes.text;
					return user.prompt(`Introdusca la marca:`, true);
				} else if (rfcRes.submitted) {
					user.prompt(
						"Lo sentimos pero el RFC es necesario para la busqueda"
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

	private showActor(actor: MRE.Actor, show: boolean, y?: number) {
		actor.appearance.enabled = show;
		actor.transform.local.position.y = show ? y : 10;
	}

	private createText(
		contents: string,
		name: string,
		anchor: MRE.TextAnchorLocation,
		parentId: MRE.Guid,
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

	private kybSearch(companyName: string, rfc: string, brand: string) {
		console.log(companyName, rfc, brand);
		this.showActor(this.startButton, false);
		const waitingText = this.createText(
			"Por favor espere un rato ...",
			"waitingText",
			MRE.TextAnchorLocation.MiddleCenter,
			null
		);

		this.consult(companyName, brand, rfc).then((res) => {
			this.createOptions();
			waitingText.destroy();
			this.createOptionsData(res[0], res[1]);
		});
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
			-0.5,
			0,
			0,
			0.9,
			1.5,
			BUTTONWIDTH
		);
		this.createBoxLabel("SAT", satButtonBox.id, 1, 0.5);
		satButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.showSAT());

		const impiButtonBox = this.createButtonBox(
			"impiButton",
			baseOptions.id,
			0.5,
			0,
			0,
			0.9,
			1.5,
			BUTTONWIDTH
		);
		this.createBoxLabel("IMPI", impiButtonBox.id, 1, 0.5);
		impiButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.showIMPI());

		const exitButtonBox = this.createButtonBox(
			"newSearch",
			baseOptions.id,
			0,
			1,
			0,
			0.6,
			0.4,
			BUTTONWIDTH
		);
		this.createBoxLabel("Exit", exitButtonBox.id, 1, 1.6);
		exitButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.exitKYB());
	}

	private destroyActorInBase(name: string) {
		const actor = this.base.findChildrenByName("baseOptions", true);
		if (actor.length > 0) {
			actor[0].destroy();
		}
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
			0,
			0,
			0,
			3,
			2,
			0.02
		);

		const satButtonBox = this.createButtonBox(
			"satButton",
			baseOptionsData.id,
			-0.9,
			1.5,
			0,
			0.7,
			0.4,
			BUTTONWIDTH
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
				text: {
					contents: "sat Body",
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: TEXTHEIGHT,
				},
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
			0.9,
			1.5,
			0,
			0.7,
			0.4,
			BUTTONWIDTH
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
				text: {
					contents: "impi Body",
					anchor: MRE.TextAnchorLocation.MiddleCenter,
					height: TEXTHEIGHT,
				},
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

		const exitButtonBox = this.createButtonBox(
			"newSearch",
			baseOptionsData.id,
			0,
			1.5,
			0,
			0.6,
			0.4,
			BUTTONWIDTH
		);
		this.createBoxLabel("Exit", exitButtonBox.id, 1, 1.6);
		exitButtonBox
			.setBehavior(MRE.ButtonBehavior)
			.onClick(() => this.exitKYB());

		return baseOptionsData;
	}

	private fillSatBody(satBody: MRE.Actor, sat: Promise<any>) {
		console.log(sat);
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
		this.showActor(this.startButton, true, 0);
	}

	private createButtonBox(
		name: string,
		parentId: MRE.Guid,
		xPos: number,
		yPos: number,
		zPos: number,
		xScl: number,
		yScl: number,
		zScl: number
	): MRE.Actor {
		return MRE.Actor.CreatePrimitive(this.assets, {
			definition: { shape: MRE.PrimitiveShape.Box },
			actor: {
				parentId: parentId,
				name: name,
				collider: { geometry: { shape: MRE.ColliderType.Auto } },
				transform: {
					local: {
						scale: { x: xScl, y: yScl, z: zScl },
						position: { x: xPos, y: yPos, z: zPos },
					},
				},
			},
		});
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
						position: { x: 0, y: 0, z: -1 },
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

	private consult(
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
					console.log("Brands listas");
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

		return Promise.allSettled([satConsult, brandsConsult]).then((ress) => {
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
		});
	}
}
